# Graphify AI — Phase 3: AI Schema Understanding

## Context

Phases 1-2 create a transparent rule-based product. Phase 3 adds LLM assistance for semantic column understanding and richer schema explanations, while keeping rule-based output as a fallback.

## Goal

Add an AI schema layer that:

1. Interprets what each column means.
2. Proposes 3 ranked graph schemas with trade-offs.
3. Explains why nodes, edges, features, and labels were selected.
4. Validates every AI output against actual dataset columns.
5. Falls back to Phase 1-2 rules when AI output is invalid or unavailable.

## Backend Tasks

### 1. LLM Engine

Create a provider wrapper with:

- structured JSON responses
- retries on malformed JSON
- timeout handling
- request/response logging without storing secrets
- cache by dataset profile hash

Do not hard-code a single model name into business logic. Keep model choice configurable through settings.

### 2. Column Semantic Analyzer

Input:

- filename
- row count
- column profiles
- sample values

Output per column:

- semantic meaning
- entity hint
- role: `entity_id`, `edge_feature`, `node_feature`, `label`, `timestamp`, `irrelevant`
- confidence
- reasoning

Merge LLM output with rule-based roles. If confidence is low or references are invalid, prefer the rule-based result.

### 3. AI Schema Recommender

Generate exactly 3 schema candidates:

1. Simple schema.
2. Event/transaction-centered schema when appropriate.
3. Rich heterogeneous schema.

Each schema must include:

- node types
- edge types
- feature assignments
- suggested tasks
- quality score
- strengths
- weaknesses
- warnings
- recommended baseline model

### 4. Explanation Endpoint

Add endpoint to explain a selected schema in plain language for data science students new to graph ML.

Cover:

- graph shape
- why the structure captures relationships
- suitable ML tasks
- data risks
- first baseline to try

### 5. Optional Chat

Schema chat is optional after the explanation endpoint works. Do not block Phase 3 completion on streaming chat.

## Acceptance Criteria

- AI identifies `user_id`, `merchant_id`, `device_id`, `transaction_id`, `timestamp`, and `is_fraud` correctly on fraud data.
- AI output never references columns that do not exist.
- Invalid AI JSON falls back to rule-based schema.
- Explanation is specific to actual column names.
- AI schemas are visibly richer than rule-only schemas.
- No user-facing feature depends exclusively on the LLM being available.
