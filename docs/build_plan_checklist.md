# Relagraph Initial Build: Phase-by-Phase Execution Checklist

## Source of Truth (Read First)

This checklist is derived from and constrained by:
- `docs/api_spec.md`
- `docs/graph_projection_contract.md`
- `docs/canonical_dtos.md`
- `docs/sql_schema.md`
- `docs/editing_flows.md`
- `docs/frontend_architecture.md`
- `docs/ui_framework.md`
- `docs/tech_stack.md`
- `docs/relationship_graph_schema.md`

## Global Non-Negotiables

- [ ] Do not redesign or modify DB schema from `docs/sql_schema.md`.
- [ ] Do not change canonical DTO shapes from `docs/canonical_dtos.md`.
- [ ] Do not invent endpoints outside `docs/api_spec.md`.
- [ ] Keep graph traversal/filter/time logic on backend per `docs/graph_projection_contract.md`.
- [ ] If a requirement is unclear, pause and ask for clarification before implementing.

---

## Phase 1: Project Setup

References: `docs/tech_stack.md`, `docs/frontend_architecture.md`

- [x] Initialize Next.js with App Router + TypeScript + Tailwind CSS.
- [x] Create directories: `/app`, `/components`, `/lib`, `/server`, `/db`, `/types`.
- [x] Install dependencies: `react`, `next`, `typescript`, `tailwindcss`, `@tanstack/react-query`, `cytoscape`, `pg` (or equivalent Postgres driver), and one ORM.
- [x] Choose ORM and stay consistent across project.
- [x] Use Drizzle as default selection (preferred in `docs/tech_stack.md`) unless explicitly overridden.

Phase gate:
- [x] App boots locally and base routes compile with no type errors.

---

## Phase 2: Environment Profiles (Local/Dev + Prod)

References: `docs/tech_stack.md`

- [x] Define two runtime profiles: `local/dev` and `prod`.
- [x] Create an environment variable contract doc section (required vars, meaning, and which profile uses each).
- [x] Add `.env.example` with all required variables and safe placeholders.
- [x] Add local/dev env configuration so app + API + DB run fully on a local machine.
- [x] Add prod env configuration contract (same variable names where possible; prod values provided by deployment platform/secrets manager).
- [x] Ensure DB connection wiring supports both profiles without code-path divergence in business logic.
- [x] Add scripts/commands for local bring-up, migration run, and app start.

Phase gate:
- [x] Fresh clone + local env setup can run DB migrations, start app, and exercise API/UI without external production dependencies.

---

## Phase 3: Database Layer

References: `docs/sql_schema.md`, `docs/relationship_graph_schema.md`

- [x] Create DB migration setup.
- [x] Implement all tables, enums, indexes, constraints, and FK behaviors exactly as specified.
- [x] Create `/db/schema.ts` reflecting SQL schema exactly.
- [x] Create `/db/client.ts` for Postgres connection.
- [x] Ensure no schema drift from `docs/sql_schema.md`.

Phase gate:
- [x] Migrations apply cleanly on a fresh database.
- [x] Schema inspection confirms exact table/index/constraint presence.

---

## Phase 4: Canonical Types (Critical)

Reference: `docs/canonical_dtos.md`

- [x] Create canonical TypeScript DTO files under `/types`.
- [x] Define at minimum: `Entity`, `Edge`, `RelationshipParticipant`, `RelationshipInterval`, `Event`, `Name`, `Media`, `GraphResponse`.
- [x] Match field names and nullability exactly.
- [x] Reuse these types in API handlers, projection logic, and frontend graph state.
- [x] Remove or avoid duplicate shape definitions elsewhere.

Phase gate:
- [x] Single canonical type source exists and is imported everywhere DTOs are needed.

---

## Phase 5: API Layer (Initial Endpoints)

References: `docs/api_spec.md`, `docs/graph_projection_contract.md`

Implement in `/app/api/v1/...` or `/server/api/...`:

- [x] `POST /api/v1/auth/register`.
- [x] NextAuth credential/session routes under `/api/auth/*`.
- [x] `GET /api/v1/auth/me`.
- [x] `GET /api/v1/graphs` and `POST /api/v1/graphs`.
- [x] `POST /api/v1/graphs/:graphId/graph/view`.
- [x] `POST /api/v1/graphs/:graphId/graph/expand`.
- [x] `GET /api/v1/graphs/:graphId/entities` and `POST /api/v1/graphs/:graphId/entities`.
- [x] `POST /api/v1/graphs/:graphId/relationships`.
- [x] `POST /api/v1/graphs/:graphId/relationships/:id/intervals`.

For all implemented endpoints:
- [x] Enforce `application/json`.
- [x] Return documented error envelope shape.
- [x] Use canonical DTOs for request/response typing.

Phase gate:
- [x] Endpoints are callable locally and respond with spec-compliant JSON shapes.

---

## Phase 6: Graph Projection Logic (Backend-Only)

References: `docs/graph_projection_contract.md`, `docs/canonical_dtos.md`, `docs/sql_schema.md`

- [x] Implement traversal from center entity up to requested depth.
- [x] Apply filters before traversal.
- [x] Resolve active relationships at `as_of` using interval rules.
- [x] Implement delta behavior using `already_loaded.entity_ids` and `already_loaded.relationship_ids`.
- [x] Deduplicate entities and edges globally per response.
- [x] Return `GraphResponse` exactly.
- [x] Do not return layout/position data.

Phase gate:
- [x] `/api/v1/graphs/:graphId/graph/view` returns UI-ready, time-resolved, deduplicated graph delta matching contract.

---

## Phase 7: Frontend Minimal Functional Graph

References: `docs/frontend_architecture.md`, `docs/ui_framework.md`, `docs/api_spec.md`

Page and components:
- [x] Create `/graphs/[graphId]` route (with `/graph/[entityId]` legacy redirect compatibility).
- [x] Implement `GraphCanvas` (Cytoscape).
- [x] Implement `SidePanel` placeholder.
- [x] Implement basic `TimeSlider`.

Behavior:
- [x] On load, call `/api/v1/graphs/:graphId/graph/view` via TanStack Query.
- [x] Render nodes + edges from `GraphResponse`.
- [x] On node click, call `/api/v1/graphs/:graphId/graph/expand`.
- [x] Merge returned delta into deduplicated client graph state.
- [x] Keep filtering/time/traversal logic on backend.

Phase gate:
- [x] Graph route loads, renders initial graph, and supports node expansion.

---

## Phase 8: Frontend UI Polish

References: `docs/frontend_architecture.md`, `docs/ui_framework.md`

Implement a focused design pass without changing backend contracts:

- [x] Define and apply shared UI tokens (typography, spacing, color variables) across login, graph list, and graph workspace.
- [x] Improve layout hierarchy and responsiveness for desktop + mobile breakpoints.
- [x] Upgrade visual styling for `GraphCanvas`, `SidePanel`, and `TimeSlider` while keeping behavior unchanged.
- [x] Improve empty/loading/error states for graph and auth flows.
- [x] Ensure interaction affordances are clear (selected node, hover/click cues, actionable controls).
- [x] Keep frontend changes compatible with existing API contracts and backend graph logic boundaries.

Phase gate:
- [x] UI is visually cohesive, responsive, and production-acceptable without behavioral regressions.

---

## Phase 9: Minimal Editing Flows

References: `docs/editing_flows.md`, `docs/api_spec.md`

Implement minimal UI forms and API wiring for:

- [ ] Create Entity flow:
- [x] `POST /api/v1/graphs/:graphId/entities`.
- [ ] Refresh graph or merge returned entity per flow rules.

- [ ] Create Relationship flow:
- [x] `POST /api/v1/graphs/:graphId/relationships`.
- [x] `POST /api/v1/graphs/:graphId/relationships/:id/intervals`.
- [ ] Refetch graph or merge delta per flow rules.

Phase gate:
- [ ] User can create entity and relationship from UI and see graph state update correctly.

---

## Phase 10: Constraint Compliance Check

References: all docs above

- [ ] Confirm no undocumented endpoint was added.
- [ ] Confirm no DTO variants diverge from canonical definitions.
- [ ] Confirm no frontend interval-resolution/traversal logic was introduced.
- [ ] Confirm DB schema remains unchanged from SQL spec.
- [ ] Record any unresolved ambiguity and stop for clarification if present.

Phase gate:
- [ ] Internal compliance review complete with zero contract violations.

---

## Phase 11: Final Deliverables Verification

- [ ] Project runs locally.
- [ ] Local/dev profile is documented and reproducible on a fresh machine.
- [ ] DB migrations work on clean DB.
- [ ] `/api/v1/graphs/:graphId/graph/view` returns valid `GraphResponse` payload.
- [ ] Basic graph renders in UI on `/graphs/[graphId]`.
- [ ] End-to-end flow works for create entity + create relationship + retrieve graph view.
- [ ] Prod profile variables and deployment configuration contract are documented.

Completion criteria:
- [ ] All phase gates checked.
- [ ] No deviation from source docs.
