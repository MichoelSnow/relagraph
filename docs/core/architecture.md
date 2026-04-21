# architecture.md

## Purpose
Defines enforced project structure to prevent duplication and ensure consistent abstraction.

This is a binding contract. Do not violate structure.

---

## Logical Structure (Required)

All code must be organized into these layers:

- Interface Layer → user-facing or external interaction (UI, API, CLI)
- Application Layer → orchestration, workflows, use cases
- Domain Layer → core business logic
- Shared Layer → reusable utilities and components

---

## Project Mapping

Each project must map the logical layers to its folder structure.

### Interface Layer
- app/** (Next.js routes/pages and HTTP route handlers under app/api/**)
- components/** (rendering and interaction UI: auth, graph, ui primitives)

### Application Layer
- lib/api/** (client-side API orchestration for UI workflows)
- server/api/** (request orchestration, auth/session-aware endpoint composition)
- server/graph/projection.ts (application-level graph view assembly workflow)

### Domain Layer
- types/canonical.ts (core graph DTO contract)
- docs/graph_projection_contract.md, docs/canonical_dtos.md, docs/relationship_graph_schema.md (domain rules/spec source)
- Domain invariants currently live partly in API/projection modules rather than a dedicated domain/ folder

### Shared Layer
- lib/ui/** (styles.ts, cx.ts reusable presentation utilities)
- lib/env.ts and cross-cutting helpers
- types/index.ts (shared type exports)
- db/schema.ts, db/client.ts (shared persistence primitives used by app/server code)

---

## Mapping Requirement

- Every project MUST define its folder mapping before implementing features
- Do NOT create new top-level directories without updating this mapping

---

## Rules

### 1. No Duplication
- Do NOT copy-paste components or functions
- If logic appears more than once → extract it

---

### 2. Shared Code Rules
- All reusable logic must belong to the Shared Layer
- Shared code must be accessible across the project
- Do NOT duplicate shared logic in multiple locations

---

### 3. Layer Responsibilities

- Interface Layer:
  - Handles user input / external interaction only
  - Must NOT contain business logic

- Application Layer:
  - Orchestrates workflows and use cases
  - May coordinate multiple domain operations

- Domain Layer:
  - Contains core business logic
  - Must be independent of frameworks and UI

- Shared Layer:
  - Contains reusable utilities and components
  - Must not contain business-specific logic

---

### 4. Dependency Rules

- Interface → may depend on Application and Shared
- Application → may depend on Domain and Shared
- Domain → must NOT depend on Interface or Application
- Shared → must be dependency-safe (no upward dependencies)

---

### 5. Refactoring Requirement
- When duplication is detected → refactor immediately
- Do NOT defer cleanup
- Clean up old implementations before introducing new ones

---

### 6. Edge Case Handling

- Handle edge cases explicitly (empty inputs, missing data, partial failures)
- Do not automatically keep legacy/historical compatibility code paths
- If in production → verify impact before removing code paths

---

## Mapping Enforcement

- All code placement must align with the defined mapping
- If a file does not clearly belong to a layer → reassess structure before adding it

---

## Anti-Patterns (Do NOT do)

- Duplicate logic across multiple files
- Mixing business logic into interface layer
- Cross-layer violations
- Copy-paste with minor edits

---

## Enforcement

- Prefer extraction over repetition
- Prefer composition over duplication
- Structure is not optional
