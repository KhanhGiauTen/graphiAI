# Graphify AI — Phase 2: Graph Quality & Guardrails

## Context

After Phase 1, the app can create graph schemas. Phase 2 makes the system more trustworthy by scoring graph usefulness and warning users when graph modeling may be a poor fit.

This phase still does not require LLM calls.

## Goal

Add graph modeling judgment:

1. Is this dataset actually suitable for graph representation?
2. Which schema has the best balance of interpretability, connectivity, feature richness, and task suitability?
3. What leakage, imbalance, sparsity, or scalability risks should the user notice?

## Backend Tasks

### 1. Graph Quality Scorer

Implement `GraphQualityScorer` with:

```text
score =
0.25 * entity_confidence
+ 0.20 * relationship_confidence
+ 0.20 * feature_richness
+ 0.15 * task_suitability
+ 0.10 * connectivity_estimate
+ 0.10 * interpretability
```

Return component scores, final score, strengths, weaknesses, and warnings.

### 2. Graph Suitability Decision

Return one of:

- `recommended`
- `promising_but_review`
- `weak_graph_signal`
- `not_recommended`

Use evidence such as:

- number of repeated entity ID columns
- co-occurrence density
- interaction/event-like rows
- feature availability
- label availability
- graph fragmentation estimate

### 3. Leakage Warnings

Flag likely leakage columns:

- future outcome dates: `chargeback_date`, `refund_date`, `resolved_at`
- outcome amounts: `refund_amount`, `chargeback_amount`
- post-event statuses: `final_status`, `resolution`, `dispute_result`
- columns highly correlated with label in suspicious ways

For timestamped datasets, include a warning that feature engineering should respect time ordering.

### 4. Dataset Health Checks

Add checks for:

- label imbalance
- missing values
- extremely high-cardinality features
- duplicated rows
- isolated nodes
- graph too dense or too sparse
- preview sampling limitations

### 5. Frontend Updates

Add a "Quality & Warnings" panel to schema cards:

- final score
- component score bars
- suitability badge
- top strengths
- top warnings
- "Why this matters" short explanation

## Acceptance Criteria

- Fraud demo dataset receives `recommended` or `promising_but_review`.
- A plain one-table dataset with no repeated entity IDs receives `weak_graph_signal` or `not_recommended`.
- Leakage-like columns produce explicit warnings.
- Label imbalance is detected for fraud data.
- Scores are explainable and deterministic.
