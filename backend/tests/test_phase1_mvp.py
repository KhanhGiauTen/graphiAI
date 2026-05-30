import subprocess
import sys
import time
import zipfile
import json
import os
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.profiler import DataProfiler
from app.services.schema_recommender import RuleBasedSchemaRecommender


FIXTURE_DIR = Path(__file__).parent / "fixtures"
FRAUD_CSV = FIXTURE_DIR / "fraud_transactions.csv"
RATINGS_CSV = FIXTURE_DIR / "user_ratings.csv"


def test_profiler_detects_expected_fraud_roles() -> None:
    profile = DataProfiler().profile(str(FRAUD_CSV))
    roles = {column.name: column.inferred_role for column in profile.columns}

    assert roles["user_id"] == "id"
    assert roles["transaction_id"] == "id"
    assert roles["merchant_id"] == "id"
    assert roles["device_id"] == "id"
    assert roles["amount"] == "numerical"
    assert roles["timestamp"] == "timestamp"
    assert roles["is_fraud"] == "label"
    assert profile.has_timestamps is True


def test_rule_recommender_ranks_transaction_schema_highest_for_fraud() -> None:
    profile = DataProfiler().profile(str(FRAUD_CSV))
    schemas = RuleBasedSchemaRecommender().recommend(profile)

    assert len(schemas) == 3
    assert schemas[0].id == "rule_transaction_centered"
    assert schemas[0].quality_score >= schemas[1].quality_score
    assert any(node.name == "Transaction" for node in schemas[0].node_types)


def test_phase1_api_e2e_upload_profile_schema_graph_export(tmp_path: Path) -> None:
    with TestClient(app) as client:
        upload_response = client.post(
            "/api/v1/upload",
            files={"file": ("fraud_transactions.csv", FRAUD_CSV.read_bytes(), "text/csv")},
        )
        assert upload_response.status_code == 200
        project_id = upload_response.json()["project_id"]

        profile_response = client.post(f"/api/v1/profile/{project_id}")
        assert profile_response.status_code == 200
        assert "transaction_id" in profile_response.json()["id_columns"]

        schema_response = client.post(f"/api/v1/schema/recommend/{project_id}")
        assert schema_response.status_code == 200
        schemas = schema_response.json()
        assert len(schemas) == 3
        assert schemas[0]["id"] == "rule_transaction_centered"

        project_response = client.get(f"/api/v1/projects/{project_id}")
        assert project_response.status_code == 200
        assert project_response.json()["graph_schemas"][0]["id"] == "rule_transaction_centered"

        graph_response = client.post(
            f"/api/v1/graph/build/{project_id}",
            json={"schema_id": "rule_transaction_centered", "sample_size": 20},
        )
        assert graph_response.status_code == 200
        graph = graph_response.json()
        assert graph["stats"]["num_node_types"] >= 3
        assert graph["stats"]["num_edges"] > 0

        export_response = client.post(
            f"/api/v1/export/{project_id}",
            json={"schema_id": "rule_transaction_centered"},
        )
        assert export_response.status_code == 200
        bundle = export_response.json()
        phase1_files = {"schema.json", "graph_nodes.csv", "graph_edges.csv", "networkx_builder.py"}
        assert phase1_files.issubset(set(bundle["files"]))
        assert {"graph_labels.csv", "pyg_dataset.py", "graphify_baseline.ipynb"}.issubset(set(bundle["files"]))

    zip_path = Path(bundle["zip_path"])
    assert zip_path.exists()
    with zipfile.ZipFile(zip_path) as archive:
        assert sorted(archive.namelist()) == sorted(bundle["files"])
        archive.extractall(tmp_path)

    result = subprocess.run(
        [sys.executable, str(tmp_path / "networkx_builder.py"), str(FRAUD_CSV)],
        check=True,
        capture_output=True,
        text=True,
    )
    assert "Graph:" in result.stdout

    notebook = json.loads((tmp_path / "graphify_baseline.ipynb").read_text(encoding="utf-8"))
    assert notebook["nbformat"] == 4
    assert any("build_hetero_data" in "".join(cell["source"]) for cell in notebook["cells"])
    assert any("degree features" in "".join(cell["source"]) for cell in notebook["cells"])

    labels = (tmp_path / "graph_labels.csv").read_text(encoding="utf-8")
    assert "is_fraud" in labels
    assert "Transaction:T001" in labels

    pyg_code = (tmp_path / "pyg_dataset.py").read_text(encoding="utf-8")
    assert "from torch_geometric.data import HeteroData" in pyg_code
    assert "transaction_id" in pyg_code
    compile(pyg_code, "pyg_dataset.py", "exec")

    old_cwd = Path.cwd()
    try:
        os.chdir(tmp_path)
        namespace: dict[str, object] = {}
        for cell in notebook["cells"]:
            if cell["cell_type"] == "code":
                exec("".join(cell["source"]), namespace)
    finally:
        os.chdir(old_cwd)


def test_upload_rejects_non_csv() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/upload",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )

    assert response.status_code == 400


def test_phase4_export_switches_notebook_to_unsupervised_when_no_label(tmp_path: Path) -> None:
    with TestClient(app) as client:
        upload_response = client.post(
            "/api/v1/upload",
            files={"file": ("user_ratings.csv", RATINGS_CSV.read_bytes(), "text/csv")},
        )
        project_id = upload_response.json()["project_id"]
        client.post(f"/api/v1/profile/{project_id}")
        client.post(f"/api/v1/schema/recommend/{project_id}")
        export_response = client.post(f"/api/v1/export/{project_id}")

    assert export_response.status_code == 200
    zip_path = Path(export_response.json()["zip_path"])
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(tmp_path)

    notebook_text = (tmp_path / "graphify_baseline.ipynb").read_text(encoding="utf-8")
    assert "No label column found" in notebook_text
    assert "user_id" in (tmp_path / "pyg_dataset.py").read_text(encoding="utf-8")
    assert "product_id" in (tmp_path / "pyg_dataset.py").read_text(encoding="utf-8")


def test_phase1_services_handle_1000_rows_under_three_seconds(tmp_path: Path) -> None:
    csv_path = tmp_path / "fraud_1000.csv"
    rows = ["user_id,transaction_id,merchant_id,device_id,amount,timestamp,is_fraud"]
    for index in range(1000):
        rows.append(
            f"U{index % 80:03d},T{index:04d},M{index % 20:03d},D{index % 40:03d},"
            f"{100 + index % 500}.0,2026-01-{(index % 28) + 1:02d}T10:00:00,{1 if index % 50 == 0 else 0}"
        )
    csv_path.write_text("\n".join(rows), encoding="utf-8")

    started = time.perf_counter()
    profile = DataProfiler().profile(str(csv_path))
    schemas = RuleBasedSchemaRecommender().recommend(profile)
    elapsed = time.perf_counter() - started

    assert elapsed < 3.0
    assert schemas[0].id == "rule_transaction_centered"
