"""Export only synthetic fixtures through the real Graphify analysis services."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.graph_builder import GraphBuilder
from app.services.graph_quality import GraphQualityScorer
from app.services.profiler import DataProfiler
from app.services.schema_recommender import RuleBasedSchemaRecommender

DATASETS = [
    ("fraud_transactions", "Fraud transactions"),
    ("user_ratings", "Product ratings"),
    ("student_courses", "Learning analytics"),
]


def build_demo() -> list[dict]:
    result = []
    for dataset_id, name in DATASETS:
        path = ROOT / "backend" / "tests" / "fixtures" / f"{dataset_id}.csv"
        profile = DataProfiler().profile(str(path))
        profile.filename = path.name
        schemas = RuleBasedSchemaRecommender().recommend(profile)
        if not schemas:
            raise ValueError(f"No schemas for {dataset_id}")
        variants = []
        for schema in schemas:
            preview = GraphBuilder().build(str(path), schema)
            node_ids = {node.id for node in preview.nodes}
            if not all(edge.source in node_ids and edge.target in node_ids for edge in preview.edges):
                raise ValueError("Graph contains dangling edges")
            variants.append({
                "schema": schema.model_dump(mode="json"),
                "preview": preview.model_dump(mode="json"),
                "quality": GraphQualityScorer().assess(profile, schema).model_dump(mode="json"),
            })
        result.append({"id": dataset_id, "name": name, "profile": profile.model_dump(mode="json"), "variants": variants})
    return result


if __name__ == "__main__":
    output = ROOT / "frontend" / "src" / "data" / "public-demo.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(build_demo(), indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Exported {len(DATASETS)} synthetic datasets to {output.name}")
