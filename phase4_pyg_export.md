# Graphify AI — Phase 4: PyG Notebook Export & Baselines

## Context

After the app can infer and explain schemas, Phase 4 turns the project into a stronger graph ML portfolio artifact by exporting runnable PyTorch Geometric starter notebooks.

In-app training is still deferred. The first priority is code users can download and run.

## Goal

Generate a runnable notebook/script bundle for graph ML experimentation:

1. Build graph files from the selected schema.
2. Convert graph data into PyG-compatible structures.
3. Train one reliable baseline.
4. Show evaluation metrics where labels exist.

## Scope

### Required

- Export `pyg_dataset.py`.
- Export `graphify_baseline.ipynb`.
- Support `HeteroData` for schemas with multiple node/edge types.
- Include one baseline path:
  - Node2Vec + classifier for general graph embeddings, or
  - GraphSAGE for a clearly labeled node classification setup.

### Deferred

- In-app model training.
- GAT.
- HeteroGNN training UI.
- Live loss charts.
- UMAP dashboard inside the web app.
- GPU Docker setup.

## Notebook Sections

1. Setup and imports.
2. Load CSV.
3. Load `schema.json`.
4. Build node ID maps.
5. Build edges.
6. Build PyG `HeteroData`.
7. Run one baseline.
8. Print metrics.
9. Notes on leakage and temporal splits.

## Acceptance Criteria

- Exported notebook opens in Jupyter.
- Notebook runs on the fraud demo dataset.
- Generated code uses actual column names.
- Heterogeneous schemas produce valid `HeteroData` metadata.
- If no label exists, notebook switches to unsupervised embedding/demo mode.
- The web app clearly says that exported baselines are starters, not final models.
