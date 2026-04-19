# Relagraph Engineering Guide

_Last updated: 2026-04-18_

## Purpose

- Single reference for coding standards, testing strategy, and workflow conventions.
- Keep the codebase consistent, readable, and maintainable for future teams.
- Favor simple, explicit code over clever abstractions.

## Code Standards

- Prefer small functions with clear names and single responsibility.
- Avoid global state unless intentionally shared.
- Handle edge cases explicitly (missing inputs, empty result sets, invalid timestamps).
- Avoid copy-paste divergence by extracting shared helpers.
- Remove dead code during refactors.
- Avoid circular imports.
- Keep TypeScript strict and avoid `any` unless unavoidable.

## API And DTO Contract Rules

- All v1 endpoints must follow `docs/api_spec.md`.
- Graph projection behavior must follow `docs/graph_projection_contract.md`.
- Use canonical DTOs from `types/canonical.ts` / `types/index.ts`.
- Error responses must follow:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

- Enforce `Content-Type: application/json` for JSON endpoints.
- Do not move graph traversal/filter/time logic to the frontend.

## Logging And Error Handling

- Return user-safe API errors; avoid leaking internals in messages.
- Prefer structured server logs over ad hoc console noise.
- Do not silently swallow critical failures (DB errors, contract violations).
- For non-critical degraded behavior, log explicitly and return deterministic responses.

## Testing Strategy

### Goals

- Catch contract regressions early (API shape, DTO shape, graph projection semantics).
- Keep tests close to business behavior (time filtering, traversal, delta merge).
- Keep test runtime practical for PR feedback loops.

### Test Layers

- Unit tests:
  - Pure helpers in `server/`, `lib/`, and DTO/mapper logic.
  - Graph projection rules (filter-before-traversal, interval activity at `as_of`, dedup, delta behavior).
- API route integration tests:
  - `POST /api/v1/graph/view`
  - `POST /api/v1/graph/expand`
  - `POST /api/v1/entities`
  - `POST /api/v1/relationships`
  - `POST /api/v1/relationships/:id/intervals`
  - Include success, validation failure, and not-found cases.
- Database and migration tests:
  - Validate migrations apply cleanly on a fresh database.
  - Validate expected enum/table/index presence after migrate.
- Frontend component tests:
  - `GraphCanvas` render mapping (nodes/edges from `GraphResponse`).
  - `GraphExplorer` behavior for initial view fetch + expand merge.
  - Error and loading states.
- End-to-end smoke tests:
  - Minimal happy path: create entity, create relationship, load `/graph/[entityId]`, expand node.

### Contract-Focused Coverage

- API responses must match `docs/api_spec.md` and canonical DTO shapes in `docs/canonical_dtos.md`.
- Graph projection behavior must match `docs/graph_projection_contract.md`:
  - time resolution at `as_of`
  - filters applied before traversal
  - delta-only return using `already_loaded`
  - deduplicated `entities` and `edges`

### CI Expectations

- Current mandatory checks in CI:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm db:migrate`
- Add automated test execution to CI as test suites are introduced, then make them required for merge.

## Security Baseline

- No secrets committed to git (`.env` is local-only).
- Run dependency/security checks in CI over time (npm/pnpm advisories, secret scanning).
- Validate request inputs at API boundaries.
- Avoid exposing internal stack traces in API responses.

## CI And Quality Gates

CI workflow (`.github/workflows/ci.yml`) runs on push/PR and must stay green.

## Branching and Workflow
### Goals
- Keep `main` always releasable.
- Encourage short-lived branches with fast review.
- Make CI checks the default gate for merges.

### Branch Types
- `main`: stable, protected, and release-ready.
- `feature/*`: short-lived branches for new work.
- `fix/*`: targeted bugfix branches.
- `chore/*`: tooling and housekeeping changes.

### Workflow
1. Create a branch from `main`.
2. Keep scope small and focused.
3. Open a pull request early for visibility.
4. CI runs on every push and PR.
5. Merge to `main` after review and green checks.

### Merge Policy
- Prefer squash merges to keep history clean.
- Require CI checks before merge.
- Avoid merging broken tests.

### Naming Conventions
- Use a clear, descriptive suffix: `feature/ai-opt-in-toggle`.
- Include a ticket ID if one exists.

## Documentation Maintenance

Update docs in the same PR when changing:
- API behavior/contracts
- DTO shapes
- DB schema/migrations workflow
- Required commands or CI behavior
- Graph projection semantics
