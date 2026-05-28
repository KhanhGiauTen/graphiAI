# Graphify AI — Phase 6: Platform Expansion

## Context

Only start this phase after the core product has users or strong portfolio demos. Phase 6 contains expensive and operationally complex features.

## Goal

Expand Graphify AI into a broader graph ML platform.

## Candidate Features

- In-app experiment runner.
- Node2Vec, GraphSAGE, GAT, and HeteroGNN training jobs.
- Live training metrics.
- Embedding visualization.
- Team workspaces.
- Public API and API keys.
- Rate limiting.
- Usage billing.
- Advanced AutoML for graph schema/model selection.

## Implementation Notes

- Add Redis/Celery or another job system only when long-running jobs are truly needed.
- Add GPU support only after CPU baselines are valuable.
- Keep generated code export as the reliable fallback even if in-app experiments fail.

## Acceptance Criteria

- Long-running experiment jobs do not block web requests.
- Users can compare at least two baseline runs.
- API keys are hashed and rate-limited.
- Team access control is tested.
- Costs are observable before opening the feature publicly.
