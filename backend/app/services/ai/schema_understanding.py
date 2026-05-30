from __future__ import annotations

import asyncio
import hashlib
import json
from itertools import combinations

from app.config import settings
from app.schemas.ai_schema import (
    AISchemaResponse,
    ColumnSemantic,
    ColumnSemanticAnalysis,
    SchemaExplanationResponse,
)
from app.schemas.dataset import ColumnProfile, DatasetProfile
from app.schemas.graph import EdgeType, GraphSchema, NodeType
from app.services.ai.engine import LLMEngine, LLMUnavailableError
from app.services.graph_quality import GraphQualityScorer


ENTITY_HINTS = {
    "user": "User",
    "customer": "Customer",
    "cust": "Customer",
    "merchant": "Merchant",
    "shop": "Shop",
    "seller": "Seller",
    "product": "Product",
    "item": "Item",
    "sku": "Product",
    "transaction": "Transaction",
    "txn": "Transaction",
    "order": "Order",
    "device": "Device",
    "ip": "IPAddress",
    "student": "Student",
    "course": "Course",
    "assignment": "Assignment",
    "account": "Account",
    "card": "Card",
}

DOMAIN_HINTS = {
    "fraud": "banking/fintech",
    "merchant": "banking/fintech",
    "transaction": "banking/fintech",
    "rating": "e-commerce/recommendation",
    "product": "e-commerce/recommendation",
    "student": "education",
    "course": "education",
    "assignment": "education",
    "patient": "healthcare",
    "drug": "healthcare",
}


class ColumnSemanticAnalyzer:
    def analyze(self, profile: DatasetProfile) -> ColumnSemanticAnalysis:
        columns = [self._semantic_for_column(column) for column in profile.columns]
        domain = self._infer_domain(profile)
        tasks = self._potential_tasks(profile, columns)
        summary = self._summary(profile, domain, columns)
        return ColumnSemanticAnalysis(
            columns=columns,
            dataset_domain=domain,
            dataset_summary=summary,
            potential_tasks=tasks,
        )

    def _semantic_for_column(self, column: ColumnProfile) -> ColumnSemantic:
        normalized = column.name.lower()
        entity_hint = self._entity_hint(normalized)

        if column.inferred_role == "id" and entity_hint:
            return ColumnSemantic(
                column_name=column.name,
                semantic_meaning=f"Identifier for {entity_hint} entities.",
                entity_hint=entity_hint,
                role="entity_id",
                reasoning=f"`{column.name}` is profiled as an ID and its name suggests {entity_hint}.",
                confidence=0.95,
            )
        if column.inferred_role == "id":
            fallback_entity = _title_from_column(column.name)
            return ColumnSemantic(
                column_name=column.name,
                semantic_meaning=f"Identifier for {fallback_entity} entities.",
                entity_hint=fallback_entity,
                role="entity_id",
                reasoning=f"`{column.name}` is profiled as an ID-like column.",
                confidence=0.78,
            )
        if column.inferred_role == "label":
            return ColumnSemantic(
                column_name=column.name,
                semantic_meaning="Target or outcome column for supervised evaluation.",
                role="label",
                reasoning=f"`{column.name}` is profiled as a label-like column.",
                confidence=0.90,
            )
        if column.inferred_role == "timestamp":
            return ColumnSemantic(
                column_name=column.name,
                semantic_meaning="Event time or temporal ordering feature.",
                role="timestamp",
                reasoning=f"`{column.name}` looks temporal by name or parseability.",
                confidence=0.88,
            )
        if column.inferred_role in {"numerical", "categorical"}:
            return ColumnSemantic(
                column_name=column.name,
                semantic_meaning=f"{column.inferred_role.title()} attribute that can enrich nodes or edges.",
                role="edge_feature" if self._is_event_feature(normalized) else "node_feature",
                reasoning=f"`{column.name}` is a {column.inferred_role} feature from profiling.",
                confidence=0.72,
            )
        if column.inferred_role == "text":
            return ColumnSemantic(
                column_name=column.name,
                semantic_meaning="Free-text attribute that may need embedding or exclusion.",
                role="node_feature",
                reasoning=f"`{column.name}` appears text-like and should be handled carefully.",
                confidence=0.64,
            )
        return ColumnSemantic(
            column_name=column.name,
            semantic_meaning="Column meaning is unclear from name and profile alone.",
            role="irrelevant",
            reasoning=f"`{column.name}` did not match a confident semantic pattern.",
            confidence=0.35,
        )

    def _entity_hint(self, normalized_name: str) -> str | None:
        for pattern, entity in ENTITY_HINTS.items():
            if pattern in normalized_name:
                return entity
        return None

    def _is_event_feature(self, normalized_name: str) -> bool:
        return any(token in normalized_name for token in ["amount", "price", "score", "rating", "count", "time"])

    def _infer_domain(self, profile: DatasetProfile) -> str:
        names = " ".join(column.name.lower() for column in profile.columns)
        for hint, domain in DOMAIN_HINTS.items():
            if hint in names:
                return domain
        return "unknown"

    def _potential_tasks(
        self,
        profile: DatasetProfile,
        columns: list[ColumnSemantic],
    ) -> list[str]:
        entity_names = {column.entity_hint or "" for column in columns if column.role == "entity_id"}
        tasks: list[str] = []
        if any("fraud" in label.lower() for label in profile.label_columns):
            tasks.append("Fraud Detection")
        elif profile.label_columns:
            tasks.append("Node or Edge Classification")
        has_actor = any(name in entity_names for name in ["User", "Customer", "Student"])
        has_item = any(name in entity_names for name in ["Product", "Item"])
        if has_actor and has_item:
            tasks.append("Recommendation")
        if len(entity_names) >= 2:
            tasks.append("Link Prediction")
        if profile.has_timestamps:
            tasks.append("Temporal Graph Analysis")
        if not profile.label_columns:
            tasks.extend(["Community Detection", "Anomaly Detection"])
        return _dedupe(tasks)

    def _summary(
        self,
        profile: DatasetProfile,
        domain: str,
        columns: list[ColumnSemantic],
    ) -> str:
        entities = [column.entity_hint for column in columns if column.role == "entity_id" and column.entity_hint]
        entity_text = ", ".join(_dedupe(entities)) or "no clear entities"
        return (
            f"This {domain} dataset has {profile.row_count} rows and {profile.column_count} columns. "
            f"It appears to contain {entity_text} with {len(profile.label_columns)} label column(s)."
        )


class AISchemaRecommender:
    def recommend(
        self,
        profile: DatasetProfile,
        semantics: ColumnSemanticAnalysis,
    ) -> list[GraphSchema]:
        entity_columns = [column for column in semantics.columns if column.role == "entity_id" and column.entity_hint]
        feature_columns = [
            column.column_name
            for column in semantics.columns
            if column.role in {"edge_feature", "node_feature", "timestamp"}
        ]

        schemas = [
            self._simple_schema(profile, semantics, entity_columns, feature_columns),
            self._event_centered_schema(profile, semantics, entity_columns, feature_columns),
            self._heterogeneous_schema(profile, semantics, entity_columns, feature_columns),
        ]
        valid_schemas = [schema for schema in schemas if schema is not None]
        return sorted(valid_schemas, key=lambda schema: schema.quality_score, reverse=True)[:3]

    def _simple_schema(
        self,
        profile: DatasetProfile,
        semantics: ColumnSemanticAnalysis,
        entity_columns: list[ColumnSemantic],
        feature_columns: list[str],
    ) -> GraphSchema | None:
        if len(entity_columns) < 2:
            return None

        source, target = self._best_pair(entity_columns)
        schema = GraphSchema(
            id="ai_simple_bipartite",
            name="AI Simple Bipartite Graph",
            description=f"Connect {source.entity_hint} and {target.entity_hint} directly when they co-occur in a row.",
            node_types=[
                NodeType(
                    name=source.entity_hint or _title_from_column(source.column_name),
                    source_column=source.column_name,
                    feature_columns=[],
                    reasoning=source.reasoning,
                ),
                NodeType(
                    name=target.entity_hint or _title_from_column(target.column_name),
                    source_column=target.column_name,
                    feature_columns=[],
                    reasoning=target.reasoning,
                ),
            ],
            edge_types=[
                EdgeType(
                    source=source.entity_hint or _title_from_column(source.column_name),
                    target=target.entity_hint or _title_from_column(target.column_name),
                    relation="INTERACTS_WITH",
                    source_columns=[source.column_name, target.column_name],
                    directed=False,
                    reasoning="The two entities appear in the same event row, forming a simple relationship.",
                )
            ],
            suggested_tasks=semantics.potential_tasks,
            quality_score=0,
            strengths=["Easy to explain and visualize.", "Good first baseline for relationship exploration."],
            weaknesses=["May lose event-specific detail from other ID columns."],
            warnings=[],
            recommended_models=[{"name": "Node2Vec", "reason": "Simple graph embedding baseline."}],
        )
        return self._score_schema(profile, schema)

    def _event_centered_schema(
        self,
        profile: DatasetProfile,
        semantics: ColumnSemanticAnalysis,
        entity_columns: list[ColumnSemantic],
        feature_columns: list[str],
    ) -> GraphSchema | None:
        if len(entity_columns) < 3:
            return None

        event = self._event_entity(entity_columns)
        others = [column for column in entity_columns if column.column_name != event.column_name]
        event_name = event.entity_hint or _title_from_column(event.column_name)
        node_types = [
            NodeType(
                name=event_name,
                source_column=event.column_name,
                feature_columns=feature_columns,
                reasoning=f"{event.reasoning} This node preserves row-level event attributes.",
            )
        ]
        node_types.extend(
            NodeType(
                name=column.entity_hint or _title_from_column(column.column_name),
                source_column=column.column_name,
                feature_columns=[],
                reasoning=column.reasoning,
            )
            for column in others
        )
        edge_types = [
            EdgeType(
                source=column.entity_hint or _title_from_column(column.column_name),
                target=event_name,
                relation=self._relation_name(column, event),
                source_columns=[column.column_name, event.column_name],
                directed=True,
                reasoning=f"Connect {column.entity_hint} to the event so event features stay attached to {event_name}.",
            )
            for column in others
        ]
        schema = GraphSchema(
            id="ai_event_centered",
            name="AI Event-Centered Graph",
            description=f"Use {event_name} as an event node and connect all other entities through it.",
            node_types=node_types,
            edge_types=edge_types,
            suggested_tasks=semantics.potential_tasks,
            quality_score=0,
            strengths=["Preserves event-level features.", "Works well when one row represents an interaction or transaction."],
            weaknesses=["Creates more nodes than a direct bipartite graph."],
            warnings=["Use temporal splits if event timestamps are available."] if profile.has_timestamps else [],
            recommended_models=[{"name": "GraphSAGE", "reason": "Strong baseline for supervised node representation learning."}],
        )
        return self._score_schema(profile, schema)

    def _heterogeneous_schema(
        self,
        profile: DatasetProfile,
        semantics: ColumnSemanticAnalysis,
        entity_columns: list[ColumnSemantic],
        feature_columns: list[str],
    ) -> GraphSchema | None:
        if len(entity_columns) < 2:
            return None

        node_types = [
            NodeType(
                name=column.entity_hint or _title_from_column(column.column_name),
                source_column=column.column_name,
                feature_columns=[],
                reasoning=column.reasoning,
            )
            for column in entity_columns
        ]
        edge_types = [
            EdgeType(
                source=left.entity_hint or _title_from_column(left.column_name),
                target=right.entity_hint or _title_from_column(right.column_name),
                relation="CO_OCCURS_WITH",
                source_columns=[left.column_name, right.column_name],
                directed=False,
                reasoning="These entities co-occur in the same row and may reveal higher-order relationships.",
            )
            for left, right in combinations(entity_columns, 2)
        ]
        schema = GraphSchema(
            id="ai_full_heterogeneous",
            name="AI Full Heterogeneous Graph",
            description="Represent every detected entity type and connect co-occurring entity pairs.",
            node_types=node_types,
            edge_types=edge_types,
            suggested_tasks=semantics.potential_tasks,
            quality_score=0,
            strengths=["Captures the richest relationship surface.", "Useful for anomaly and community analysis."],
            weaknesses=["Can become dense and harder to explain as entity count grows."],
            warnings=["Preview and sampling are important for large datasets."],
            recommended_models=[{"name": "HeteroGNN", "reason": "Useful once heterogeneous graph structure is validated."}],
        )
        if feature_columns:
            schema.strengths.append(f"Feature columns available for later assignment: {', '.join(feature_columns[:5])}.")
        return self._score_schema(profile, schema)

    def _score_schema(self, profile: DatasetProfile, schema: GraphSchema) -> GraphSchema:
        report = GraphQualityScorer().assess(profile, schema)
        schema.quality_score = report.final_score
        schema.warnings = _dedupe([*schema.warnings, *report.warnings])
        schema.strengths = _dedupe([*schema.strengths, *report.strengths])
        schema.weaknesses = _dedupe([*schema.weaknesses, *report.weaknesses])
        return schema

    def _best_pair(self, entity_columns: list[ColumnSemantic]) -> tuple[ColumnSemantic, ColumnSemantic]:
        preferred = ["User", "Customer", "Student", "Account"]
        primary = next((column for column in entity_columns if column.entity_hint in preferred), entity_columns[0])
        secondary = next((column for column in entity_columns if column.column_name != primary.column_name), entity_columns[1])
        return primary, secondary

    def _event_entity(self, entity_columns: list[ColumnSemantic]) -> ColumnSemantic:
        event_names = {"Transaction", "Order", "Assignment"}
        return next((column for column in entity_columns if column.entity_hint in event_names), entity_columns[0])

    def _relation_name(self, source: ColumnSemantic, event: ColumnSemantic) -> str:
        source_name = (source.entity_hint or source.column_name).upper()
        event_name = (event.entity_hint or event.column_name).upper()
        if source_name in {"USER", "CUSTOMER", "ACCOUNT"} and event_name in {"TRANSACTION", "ORDER"}:
            return "MADE"
        if source_name in {"MERCHANT", "SHOP", "SELLER"}:
            return "PAID_TO"
        if source_name == "DEVICE":
            return "USED"
        if source_name == "STUDENT":
            return "ATTEMPTED"
        return "RELATED_TO"


class SchemaExplainer:
    def explain(
        self,
        profile: DatasetProfile,
        schema: GraphSchema,
        semantics: ColumnSemanticAnalysis | None = None,
    ) -> SchemaExplanationResponse:
        semantic_map = {
            column.column_name: column
            for column in semantics.columns
        } if semantics else {}
        nodes = ", ".join(f"{node.name} from `{node.source_column}`" for node in schema.node_types)
        edges = ", ".join(f"{edge.source} {edge.relation} {edge.target}" for edge in schema.edge_types)
        tasks = ", ".join(schema.suggested_tasks) or "exploratory graph analysis"
        column_notes = [
            f"`{name}`: {semantic.semantic_meaning}"
            for name, semantic in semantic_map.items()
            if name in {node.source_column for node in schema.node_types}
        ]
        notes = "\n".join(f"- {note}" for note in column_notes) or "- No semantic notes were provided."

        explanation = (
            f"## {schema.name}\n\n"
            f"This schema models {profile.filename or 'the dataset'} as a graph with nodes: {nodes}.\n\n"
            f"Relationships are represented as: {edges}. This structure is useful because each row can be treated "
            f"as evidence that the listed entities interacted or co-occurred.\n\n"
            f"Suggested tasks: {tasks}. Start with the recommended baseline "
            f"`{schema.recommended_models[0]['name']}` if available, then compare against a simple tabular model.\n\n"
            f"Column interpretation notes:\n{notes}\n\n"
            "Watch for leakage, class imbalance, and temporal ordering before trusting model results."
        )
        return SchemaExplanationResponse(explanation=explanation)


class AISchemaService:
    _cache: dict[str, AISchemaResponse] = {}

    def __init__(self, llm_engine: LLMEngine | None = None, mode: str | None = None) -> None:
        self.llm_engine = llm_engine or LLMEngine()
        self.mode = (mode or settings.AI_SCHEMA_MODE).lower()
        self.semantic_analyzer = ColumnSemanticAnalyzer()
        self.schema_recommender = AISchemaRecommender()

    def analyze(self, profile: DatasetProfile) -> AISchemaResponse:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self.analyze_async(profile))
        return self._heuristic_response(profile)

    async def analyze_async(self, profile: DatasetProfile) -> AISchemaResponse:
        fallback = self._heuristic_response(profile)
        if self.mode not in {"llm", "ai", "hybrid"}:
            return fallback

        cache_key = self._cache_key(profile)
        if cache_key in self._cache:
            return self._cache[cache_key].model_copy(deep=True)

        try:
            response = await self._llm_response(profile, fallback)
            validated = self._validate_llm_response(profile, response)
            validated.mode = "llm"
            self._cache[cache_key] = validated.model_copy(deep=True)
            return validated
        except (LLMUnavailableError, ValueError) as exc:
            fallback.warnings = _dedupe([*fallback.warnings, f"LLM schema analysis unavailable: {exc}"])
            return fallback

    def _heuristic_response(self, profile: DatasetProfile) -> AISchemaResponse:
        semantics = self.semantic_analyzer.analyze(profile)
        schemas = self.schema_recommender.recommend(profile, semantics)
        warnings = self._service_warnings(profile, schemas)
        return AISchemaResponse(
            mode="heuristic_fallback",
            semantics=semantics,
            schemas=schemas,
            warnings=warnings,
        )

    async def _llm_response(
        self,
        profile: DatasetProfile,
        fallback: AISchemaResponse,
    ) -> AISchemaResponse:
        return await self.llm_engine.complete_with_schema(
            system=(
                "You are Graphify AI, an expert graph machine learning engineer. "
                "Infer graph-ready semantic meaning from tabular dataset profiles. "
                "Prefer useful, explainable graph schemas for fraud, recommendation, "
                "student analytics, transaction networks, or knowledge graph use cases."
            ),
            user=json.dumps(
                {
                    "dataset_profile": profile.model_dump(),
                    "rule_based_fallback": fallback.model_dump(),
                    "requirements": [
                        "Return exactly 3 ranked graph schemas when at least 2 entity columns exist.",
                        "Use only column names that exist in dataset_profile.columns.",
                        "Explain nodes, edges, features, labels, strengths, weaknesses, and warnings.",
                        "Set recommended_models to practical baselines such as Node2Vec, GraphSAGE, GAT, or Logistic Regression.",
                    ],
                },
                ensure_ascii=True,
            ),
            pydantic_model=AISchemaResponse,
        )

    def _validate_llm_response(self, profile: DatasetProfile, response: AISchemaResponse) -> AISchemaResponse:
        valid_columns = {column.name for column in profile.columns}
        if len(response.semantics.columns) != len(profile.columns):
            raise ValueError("LLM response did not provide one semantic entry per dataset column.")
        for semantic in response.semantics.columns:
            if semantic.column_name not in valid_columns:
                raise ValueError(f"LLM semantic output referenced unknown column `{semantic.column_name}`.")

        if len(response.schemas) != 3 and len(profile.id_columns) >= 2:
            raise ValueError("LLM response did not return exactly 3 schema candidates.")
        for schema in response.schemas:
            for node in schema.node_types:
                if node.source_column not in valid_columns:
                    raise ValueError(f"LLM schema referenced unknown node column `{node.source_column}`.")
                node.feature_columns = [feature for feature in node.feature_columns if feature in valid_columns]
            for edge in schema.edge_types:
                invalid = [column for column in edge.source_columns if column not in valid_columns]
                if invalid:
                    raise ValueError(f"LLM schema referenced unknown edge column `{invalid[0]}`.")
            scored_schema = GraphQualityScorer().assess(profile, schema)
            schema.quality_score = scored_schema.final_score
            schema.warnings = _dedupe([*schema.warnings, *scored_schema.warnings])
            schema.strengths = _dedupe([*schema.strengths, *scored_schema.strengths])
            schema.weaknesses = _dedupe([*schema.weaknesses, *scored_schema.weaknesses])
        response.schemas = sorted(response.schemas, key=lambda schema: schema.quality_score, reverse=True)
        response.warnings = _dedupe(response.warnings)
        return response

    def explain(
        self,
        profile: DatasetProfile,
        schema: GraphSchema,
        semantics: ColumnSemanticAnalysis | None = None,
    ) -> SchemaExplanationResponse:
        return SchemaExplainer().explain(profile, schema, semantics)

    def _service_warnings(self, profile: DatasetProfile, schemas: list[GraphSchema]) -> list[str]:
        warnings: list[str] = []
        if not schemas:
            warnings.append("No graph schema could be generated from the current profile.")
        if len(profile.id_columns) < 2:
            warnings.append("AI schema analysis fell back to weak graph signal because fewer than 2 IDs were found.")
        return warnings

    def _cache_key(self, profile: DatasetProfile) -> str:
        digest = hashlib.sha256(profile.model_dump_json().encode("utf-8")).hexdigest()
        return f"{self.llm_engine.model}:{digest}"


def _title_from_column(column_name: str) -> str:
    cleaned = column_name.lower()
    for suffix in ["_id", "_key"]:
        if cleaned.endswith(suffix):
            cleaned = cleaned[: -len(suffix)]
    return "".join(part.capitalize() for part in cleaned.replace("-", "_").split("_") if part) or "Entity"


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            result.append(item)
            seen.add(item)
    return result
