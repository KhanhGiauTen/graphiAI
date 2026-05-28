# Graphify AI — Phase 5: Productization

## Context

Phase 5 makes the tool usable beyond a local demo, but it should stay narrower than a full SaaS platform.

## Goal

Ship a small hosted product:

1. User accounts.
2. Saved projects.
3. Shareable read-only project links.
4. Deployment with persistent storage.

## Scope

### Backend

- Email/password auth or OAuth through a managed provider.
- Project ownership.
- Shared read-only token.
- Basic usage limits for file size and AI calls.
- Migration from SQLite to PostgreSQL if deploying beyond local demo.

### Frontend

- Login/register.
- Project dashboard.
- Shared view page.
- Settings page with minimal account info.

### Infrastructure

- Dockerfile.
- Production env config.
- Hosted database.
- Object storage for uploads if local disk is not reliable.

## Deferred

- Team workspaces.
- Public API.
- Billing.
- Advanced role-based permissions.
- In-app experiment runner.

## Acceptance Criteria

- Register/login works.
- User can create and revisit projects.
- User cannot access another private project.
- Shared link works without login and is read-only.
- App deploys successfully to the selected host.
