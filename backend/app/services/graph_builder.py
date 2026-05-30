from __future__ import annotations

from typing import Any

import networkx as nx
import pandas as pd

from app.schemas.graph import GraphEdge, GraphNode, GraphPreview, GraphSchema, GraphStats


class GraphBuilder:
    def build(self, filepath: str, schema: GraphSchema, sample_size: int = 500) -> GraphPreview:
        df = pd.read_csv(filepath)
        if len(df) > sample_size:
            df = df.sample(n=sample_size, random_state=42)

        graph = nx.MultiDiGraph()
        for _, row in df.iterrows():
            for node_type in schema.node_types:
                value = row.get(node_type.source_column)
                if pd.isna(value):
                    continue
                graph.add_node(
                    node_id(node_type.name, value),
                    type=node_type.name,
                    label=str(value),
                    features={
                        feature: _json_safe(row.get(feature))
                        for feature in node_type.feature_columns
                        if feature in df.columns and not pd.isna(row.get(feature))
                    },
                )
            for edge_type in schema.edge_types:
                if len(edge_type.source_columns) < 2:
                    continue
                source_column, target_column = edge_type.source_columns[:2]
                source_value = row.get(source_column)
                target_value = row.get(target_column)
                if pd.isna(source_value) or pd.isna(target_value):
                    continue
                graph.add_edge(
                    node_id(edge_type.source, source_value),
                    node_id(edge_type.target, target_value),
                    relation=edge_type.relation,
                )

        return GraphPreview(
            schema_id=schema.id,
            stats=self._stats(graph),
            nodes=[
                GraphNode(
                    id=str(node),
                    type=str(attrs.get("type", "Unknown")),
                    label=str(attrs.get("label", node)),
                    features=dict(attrs.get("features", {})),
                )
                for node, attrs in graph.nodes(data=True)
            ],
            edges=[
                GraphEdge(
                    source=str(source),
                    target=str(target),
                    relation=str(attrs.get("relation", "RELATED_TO")),
                    features={},
                )
                for source, target, attrs in graph.edges(data=True)
            ],
        )

    def _stats(self, graph: nx.MultiDiGraph) -> GraphStats:
        node_types = {attrs.get("type", "Unknown") for _, attrs in graph.nodes(data=True)}
        edge_types = {attrs.get("relation", "RELATED_TO") for _, _, attrs in graph.edges(data=True)}
        undirected = graph.to_undirected()
        components = nx.number_connected_components(undirected) if graph.number_of_nodes() else 0
        degree_view = graph.degree()
        avg_degree = sum(dict(degree_view).values()) / max(graph.number_of_nodes(), 1)
        top_degree_nodes = [
            {"id": str(node), "type": graph.nodes[node].get("type", "Unknown"), "degree": int(degree)}
            for node, degree in sorted(graph.degree(), key=lambda item: item[1], reverse=True)[:10]
        ]
        return GraphStats(
            num_nodes=graph.number_of_nodes(),
            num_edges=graph.number_of_edges(),
            num_node_types=len(node_types),
            num_edge_types=len(edge_types),
            avg_degree=round(float(avg_degree), 4),
            density=round(float(nx.density(graph)) if graph.number_of_nodes() > 1 else 0.0, 6),
            num_connected_components=components,
            top_degree_nodes=top_degree_nodes,
        )


def node_id(node_type: str, value: Any) -> str:
    return f"{node_type}:{value}"


def _json_safe(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value
