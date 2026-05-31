from __future__ import annotations

import argparse
import json
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a Graphify AI local API smoke test.")
    parser.add_argument("--api-url", default="http://127.0.0.1:8000/api/v1", help="Versioned backend API base URL.")
    args = parser.parse_args()
    client = ApiClient(args.api_url.rstrip("/"))

    try:
        health = client.get("/health")
        demo = client.post("/demo-datasets/fraud_transactions/project")
        project_id = demo["project_id"]
        project = client.get(f"/projects/{project_id}")
        schema_id = project["selected_schema_id"] or project["graph_schemas"][0]["id"]
        report = client.get(f"/projects/{project_id}/report?schema_id={schema_id}")
        graph = client.post(f"/graph/build/{project_id}", {"schema_id": schema_id, "sample_size": 100})
        baseline = client.post(f"/experiments/baseline/{project_id}", {"schema_id": schema_id, "test_size": 0.3})
        export = client.post(f"/export/{project_id}", {"schema_id": schema_id})
    except SmokeTestError as exc:
        print(f"Smoke test failed: {exc}", file=sys.stderr)
        return 1

    checks = {
        "health": health.get("status") == "ok",
        "project": project.get("status") == "schema_recommended",
        "report": report.get("quality", {}).get("final_score", 0) > 0,
        "graph": graph.get("stats", {}).get("num_edges", 0) > 0,
        "baseline": bool(baseline.get("summary")),
        "export": "schema.json" in export.get("files", []),
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        print(f"Smoke test failed checks: {', '.join(failed)}", file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "status": "ok",
                "project_id": project_id,
                "schema_id": schema_id,
                "quality_score": report["quality"]["final_score"],
                "nodes": graph["stats"]["num_nodes"],
                "edges": graph["stats"]["num_edges"],
                "baseline_mode": baseline["mode"],
                "export_files": export["files"],
            },
            indent=2,
        )
    )
    return 0


class SmokeTestError(RuntimeError):
    pass


class ApiClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url

    def get(self, path: str) -> dict[str, Any]:
        return self._request("GET", path)

    def post(self, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request("POST", path, payload)

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        data = None
        headers = {"Accept": "application/json"}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = Request(f"{self.base_url}{path}", data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=30) as response:
                raw = response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SmokeTestError(f"{method} {path} returned {exc.code}: {detail}") from exc
        except URLError as exc:
            raise SmokeTestError(f"{method} {path} could not connect: {exc.reason}") from exc

        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SmokeTestError(f"{method} {path} returned invalid JSON") from exc


if __name__ == "__main__":
    raise SystemExit(main())
