from __future__ import annotations

import json
import zipfile
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import settings
from app.schemas.graph import GraphSchema
from app.schemas.project import ExportBundle
from app.services.graph_builder import node_id


REQUIRED_EXPORT_FILES = [
    "schema.json",
    "graph_nodes.csv",
    "graph_edges.csv",
    "graph_labels.csv",
    "networkx_builder.py",
    "pyg_dataset.py",
    "graphify_baseline.ipynb",
]


class CodeGenerator:
    def generate(self, project_id: str, filepath: str, schema: GraphSchema) -> ExportBundle:
        export_dir = Path(settings.EXPORT_DIR) / project_id
        export_dir.mkdir(parents=True, exist_ok=True)
        df = pd.read_csv(filepath)

        nodes_df, edges_df, labels_df = self._build_tables(df, schema)
        schema_path = export_dir / "schema.json"
        nodes_path = export_dir / "graph_nodes.csv"
        edges_path = export_dir / "graph_edges.csv"
        labels_path = export_dir / "graph_labels.csv"
        builder_path = export_dir / "networkx_builder.py"
        pyg_path = export_dir / "pyg_dataset.py"
        notebook_path = export_dir / "graphify_baseline.ipynb"
        zip_path = export_dir / f"graphify_export_{project_id}.zip"

        schema_path.write_text(schema.model_dump_json(indent=2), encoding="utf-8")
        nodes_df.to_csv(nodes_path, index=False)
        edges_df.to_csv(edges_path, index=False)
        labels_df.to_csv(labels_path, index=False)
        builder_path.write_text(self._networkx_builder_code(schema), encoding="utf-8")
        pyg_path.write_text(self._pyg_dataset_code(schema), encoding="utf-8")
        notebook_path.write_text(self._notebook_json(schema), encoding="utf-8")

        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for filename in REQUIRED_EXPORT_FILES:
                archive.write(export_dir / filename, arcname=filename)

        return ExportBundle(project_id=project_id, zip_path=str(zip_path), files=REQUIRED_EXPORT_FILES)

    def _build_tables(self, df: pd.DataFrame, schema: GraphSchema) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        node_rows: dict[str, dict[str, Any]] = {}
        edge_rows: list[dict[str, Any]] = []
        label_rows: dict[str, dict[str, Any]] = {}
        label_columns = label_columns_from_frame(df)
        label_target_node = label_target_node_type(schema, df) if label_columns else None
        for _, row in df.iterrows():
            for node_type in schema.node_types:
                value = row.get(node_type.source_column)
                if pd.isna(value):
                    continue
                current_node_id = node_id(node_type.name, value)
                node_rows[current_node_id] = {
                    "node_id": current_node_id,
                    "node_type": node_type.name,
                    "source_column": node_type.source_column,
                    "source_value": value,
                    **{
                        feature: row.get(feature)
                        for feature in node_type.feature_columns
                        if feature in df.columns and not pd.isna(row.get(feature))
                    },
                }
            for edge_type in schema.edge_types:
                if len(edge_type.source_columns) < 2:
                    continue
                source_column, target_column = edge_type.source_columns[:2]
                source_value = row.get(source_column)
                target_value = row.get(target_column)
                if pd.isna(source_value) or pd.isna(target_value):
                    continue
                edge_rows.append(
                    {
                        "source_id": node_id(edge_type.source, source_value),
                        "target_id": node_id(edge_type.target, target_value),
                        "relation": edge_type.relation,
                    }
                )
            if label_target_node is not None:
                target_value = row.get(label_target_node.source_column)
                if not pd.isna(target_value):
                    current_node_id = node_id(label_target_node.name, target_value)
                    label_rows[current_node_id] = {
                        "node_id": current_node_id,
                        "node_type": label_target_node.name,
                        "source_column": label_target_node.source_column,
                        **{
                            label_column: row.get(label_column)
                            for label_column in label_columns
                            if label_column in df.columns and not pd.isna(row.get(label_column))
                        },
                    }
        return (
            pd.DataFrame(node_rows.values()),
            pd.DataFrame(edge_rows),
            pd.DataFrame(label_rows.values(), columns=["node_id", "node_type", "source_column", *label_columns]),
        )

    def _networkx_builder_code(self, schema: GraphSchema) -> str:
        schema_json = json.dumps(schema.model_dump(), indent=2)
        return f'''# Auto-generated by Graphify AI
import json
import sys

import networkx as nx
import pandas as pd


SCHEMA = json.loads(r"""{schema_json}""")


def node_id(node_type, value):
    return f"{{node_type}}:{{value}}"


def build_graph(csv_path: str) -> nx.MultiDiGraph:
    df = pd.read_csv(csv_path)
    graph = nx.MultiDiGraph()

    for _, row in df.iterrows():
        for node_type in SCHEMA["node_types"]:
            source_column = node_type["source_column"]
            value = row.get(source_column)
            if pd.isna(value):
                continue
            graph.add_node(
                node_id(node_type["name"], value),
                node_type=node_type["name"],
                source_column=source_column,
                source_value=value,
            )

        for edge_type in SCHEMA["edge_types"]:
            if len(edge_type["source_columns"]) < 2:
                continue
            source_column, target_column = edge_type["source_columns"][:2]
            source_value = row.get(source_column)
            target_value = row.get(target_column)
            if pd.isna(source_value) or pd.isna(target_value):
                continue
            graph.add_edge(
                node_id(edge_type["source"], source_value),
                node_id(edge_type["target"], target_value),
                relation=edge_type["relation"],
            )

    return graph


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "your_data.csv"
    graph = build_graph(csv_path)
    print(f"Graph: {{graph.number_of_nodes()}} nodes, {{graph.number_of_edges()}} edges")
'''

    def _pyg_dataset_code(self, schema: GraphSchema) -> str:
        schema_json = json.dumps(schema.model_dump(), indent=2)
        return f'''# Auto-generated by Graphify AI
import json

import pandas as pd


SCHEMA = json.loads(r"""{schema_json}""")


def _node_ids(df, source_column):
    return [str(value) for value in df[source_column].dropna().unique()]


def _feature_matrix(df, source_column, ids, feature_columns):
    import torch

    usable = [column for column in feature_columns if column in df.columns]
    if not usable:
        return torch.ones((len(ids), 1), dtype=torch.float)

    frame = df.drop_duplicates(source_column).set_index(source_column).reindex(ids)[usable]
    frame = pd.get_dummies(frame, dummy_na=True).fillna(0)
    return torch.tensor(frame.to_numpy(dtype=float), dtype=torch.float)


def build_hetero_data(csv_path: str):
    import torch
    from torch_geometric.data import HeteroData

    df = pd.read_csv(csv_path)
    data = HeteroData()
    id_maps = {{}}

    for node_type in SCHEMA["node_types"]:
        source_column = node_type["source_column"]
        ids = _node_ids(df, source_column)
        id_maps[node_type["name"]] = {{value: index for index, value in enumerate(ids)}}
        data[node_type["name"]].x = _feature_matrix(
            df,
            source_column,
            ids,
            node_type.get("feature_columns", []),
        )

    for edge_type in SCHEMA["edge_types"]:
        if len(edge_type.get("source_columns", [])) < 2:
            continue
        source_column, target_column = edge_type["source_columns"][:2]
        source_name = edge_type["source"]
        target_name = edge_type["target"]
        source_map = id_maps[source_name]
        target_map = id_maps[target_name]

        source_indices = []
        target_indices = []
        for _, row in df.iterrows():
            source_value = str(row[source_column])
            target_value = str(row[target_column])
            if source_value in source_map and target_value in target_map:
                source_indices.append(source_map[source_value])
                target_indices.append(target_map[target_value])

        edge_index = torch.tensor([source_indices, target_indices], dtype=torch.long)
        data[(source_name, edge_type["relation"].lower(), target_name)].edge_index = edge_index

    return data


if __name__ == "__main__":
    print("Graphify AI PyG dataset helper")
    print("Schema:", SCHEMA["name"])
    print("Node types:", [node["name"] for node in SCHEMA["node_types"]])
    print("Edge types:", [(edge["source"], edge["relation"], edge["target"]) for edge in SCHEMA["edge_types"]])
'''

    def _notebook_json(self, schema: GraphSchema) -> str:
        cells = [
            markdown_cell(
                "# Graphify AI Baseline Notebook\n"
                "This notebook is a starter artifact generated from the selected graph schema. "
                "It runs from the exported graph tables, with an optional PyG conversion path if "
                "you provide the original CSV file."
            ),
            code_cell(
                "import json\n"
                "import pandas as pd\n"
                "from pathlib import Path\n\n"
                "SCHEMA_PATH = 'schema.json'\n\n"
                "schema = json.loads(Path(SCHEMA_PATH).read_text())\n"
                "nodes = pd.read_csv('graph_nodes.csv')\n"
                "edges = pd.read_csv('graph_edges.csv')\n"
                "labels = pd.read_csv('graph_labels.csv')\n"
                "print('Schema:', schema['name'])\n"
                "print('Nodes:', nodes.shape, 'Edges:', edges.shape, 'Labels:', labels.shape)"
            ),
            code_cell(
                "import networkx as nx\n\n"
                "graph = nx.MultiDiGraph()\n"
                "for _, row in nodes.iterrows():\n"
                "    graph.add_node(row['node_id'], node_type=row.get('node_type'))\n"
                "for _, row in edges.iterrows():\n"
                "    graph.add_edge(row['source_id'], row['target_id'], relation=row.get('relation'))\n"
                "print(f'Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges')\n"
                "print('Connected components:', nx.number_connected_components(graph.to_undirected()) if graph.number_of_nodes() else 0)"
            ),
            code_cell(
                "INPUT_CSV_PATH = None  # Set to your original CSV path to build PyG HeteroData.\n\n"
                "if INPUT_CSV_PATH:\n"
                "    try:\n"
                "        from pyg_dataset import build_hetero_data\n"
                "        data = build_hetero_data(INPUT_CSV_PATH)\n"
                "        print(data)\n"
                "        print('Metadata:', data.metadata())\n"
                "    except ModuleNotFoundError as exc:\n"
                "        print('Install torch and torch-geometric to build HeteroData:', exc)\n"
                "else:\n"
                "    print('PyG conversion skipped. Set INPUT_CSV_PATH after installing torch-geometric.')"
            ),
            code_cell(self._baseline_code(schema)),
            markdown_cell(
                "## Modeling Notes\n"
                "- The baseline above uses graph-derived degree features from exported edges.\n"
                "- Install `torch` and `torch-geometric` to use `pyg_dataset.py` for HeteroData.\n"
                "- Use temporal splits when timestamps exist.\n"
                "- Compare graph baselines against a simple tabular model.\n"
                "- Watch for class imbalance and leakage columns before trusting metrics."
            ),
        ]
        notebook = {
            "cells": cells,
            "metadata": {
                "kernelspec": {
                    "display_name": "Python 3",
                    "language": "python",
                    "name": "python3",
                },
                "language_info": {"name": "python", "pygments_lexer": "ipython3"},
            },
            "nbformat": 4,
            "nbformat_minor": 5,
        }
        return json.dumps(notebook, indent=2)

    def _baseline_code(self, schema: GraphSchema) -> str:
        schema_name = schema.name.replace("'", "\\'")
        return (
            "# Graph-structure baseline: degree features + logistic regression when labels exist.\n"
            "label_columns = [column for column in labels.columns if column not in {'node_id', 'node_type', 'source_column'}]\n"
            f"print('Selected schema: {schema_name}')\n"
            "if labels.empty or not label_columns:\n"
            "    print('No label column found. Showing top nodes by graph degree instead.')\n"
            "    degree_table = pd.DataFrame([\n"
            "        {'node_id': node, 'degree': degree, 'node_type': graph.nodes[node].get('node_type')}\n"
            "        for node, degree in graph.degree()\n"
            "    ]).sort_values('degree', ascending=False)\n"
            "    display(degree_table.head(10)) if 'display' in globals() else print(degree_table.head(10))\n"
            "else:\n"
            "    label_col = label_columns[0]\n"
            "    feature_rows = []\n"
            "    for node_id in labels['node_id']:\n"
            "        feature_rows.append({\n"
            "            'node_id': node_id,\n"
            "            'in_degree': graph.in_degree(node_id),\n"
            "            'out_degree': graph.out_degree(node_id),\n"
            "            'total_degree': graph.degree(node_id),\n"
            "        })\n"
            "    X = pd.DataFrame(feature_rows).set_index('node_id')\n"
            "    y = labels.set_index('node_id').loc[X.index, label_col]\n"
            "    valid = y.notna()\n"
            "    X = X.loc[valid]\n"
            "    y = y.loc[valid]\n"
            "    if len(y) < 4 or y.nunique() < 2:\n"
            "        print('Not enough labeled nodes for supervised evaluation. Label counts:')\n"
            "        print(y.value_counts(dropna=False))\n"
            "    else:\n"
            "        try:\n"
            "            from sklearn.linear_model import LogisticRegression\n"
            "            from sklearn.metrics import classification_report\n"
            "            from sklearn.model_selection import train_test_split\n"
            "            stratify = y if y.value_counts().min() >= 2 else None\n"
            "            X_train, X_test, y_train, y_test = train_test_split(\n"
            "                X, y, test_size=0.3, random_state=42, stratify=stratify\n"
            "            )\n"
            "            clf = LogisticRegression(max_iter=1000, class_weight='balanced')\n"
            "            clf.fit(X_train, y_train)\n"
            "            print(classification_report(y_test, clf.predict(X_test)))\n"
            "        except ModuleNotFoundError:\n"
            "            print('Install scikit-learn to run the supervised baseline: pip install scikit-learn')"
        )


def markdown_cell(source: str) -> dict[str, Any]:
    return {"cell_type": "markdown", "metadata": {}, "source": source.splitlines(keepends=True)}


def code_cell(source: str) -> dict[str, Any]:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": source.splitlines(keepends=True),
    }


def label_columns_from_frame(df: pd.DataFrame) -> list[str]:
    label_names = {"label", "target", "is_fraud", "fraud", "churn", "class", "y", "passed"}
    return [column for column in df.columns if column.lower() in label_names]


def label_target_node_type(schema: GraphSchema, df: pd.DataFrame):
    event_names = {"Transaction", "Order", "Assignment"}
    for node_type in schema.node_types:
        if node_type.name in event_names:
            return node_type
    return max(
        schema.node_types,
        key=lambda node_type: df[node_type.source_column].nunique(dropna=True)
        if node_type.source_column in df.columns
        else -1,
    )
