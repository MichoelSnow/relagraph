# Frontend Architecture

## Overview

Defines the frontend architecture for the Relagraph web application.

Goals:
- Implement an **ego-centric, time-aware graph explorer**
- Support **progressive expansion** and **delta-based updates**
- Keep **graph rendering, data fetching, and editing** clearly separated
- Align tightly with the **Graph Projection Contract** and **API Spec**

Stack:
- Next.js (App Router)
- React
- Cytoscape.js
- TanStack Query
- Tailwind CSS

---

## High-Level Architecture

### Layers

1. **App Shell (Next.js)**
   - Routing
   - Layout
   - Server-rendered chrome

2. **Graph Layer (Client)**
   - Cytoscape instance
   - Node/edge rendering
   - Interaction handling

3. **State & Data Layer**
   - TanStack Query (server state)
   - Local UI state (React)

4. **Panels & Forms**
   - Detail panel (node/edge)
   - Editing forms

---

## Routing Structure (App Router)

```
/app
  /page.tsx                    -> auth-aware redirect
  /login/page.tsx
  /graphs/page.tsx
  /graphs/[graphId]/page.tsx
  /graph/[entityId]/page.tsx   -> legacy redirect
```

- Primary route: `/graphs/:graphId`
- Query params:
  - `as_of`
  - filters

---

## Core State Model

### Global UI State

```ts
type UIState = {
  graphId: string
  centerEntityId: string
  asOf: string // ISO timestamp
  depth: number
  filters: {
    entityTypes: string[]
    relationshipTypes: string[]
    includeInactive: boolean
  }
}
```

---

### Graph State (Client)

```ts
type GraphState = {
  entities: Record<string, Entity>
  edges: Record<string, Edge>
}
```

- Always **deduplicated**
- Updated via **delta responses**

---

## Data Fetching

### TanStack Query Usage

#### Query Keys

- `graph:view`
- `graph:expand`
- `graphs:list`
- `auth:me`

---

### Fetch: Initial Graph

```ts
POST /graphs/:graphId/graph/view
```

Triggered when:
- page loads
- center node changes
- time changes
- filters change

---

### Fetch: Expand Node

```ts
POST /graphs/:graphId/graph/expand
```

Triggered when:
- user clicks a node to expand

---

### Merge Strategy

- Backend returns **delta**
- Client:
  - merges entities by ID
  - merges edges by ID
  - ignores duplicates

---

## Graph Rendering

### Library
- Cytoscape.js

### Node Mapping

```ts
{
  data: {
    id,
    label,
    entityKind
  }
}
```

### Edge Mapping

```ts
{
  data: {
    id,
    source,
    target,
    relationshipType,
    active
  }
}
```

---

### Layout

- Handled entirely in frontend
- Use:
  - force-directed (default)
  - optional presets later

---

## Interaction Model

### Node

- Click:
  - expand node (fetch delta)
  - open detail panel
- Hover:
  - show preview

---

### Edge

- Click:
  - open relationship detail panel
- Hover:
  - show type + time

---

### Graph Controls

- Pan / zoom
- Reset view
- Optional focus mode (later)

---

## Time Controls

### Time Slider

- Controls `asOf` in global state
- Triggers:
  - refetch `/graphs/:graphId/graph/view`

---

### Playback

- Animates `asOf`
- Uses same fetch mechanism

---

## Filtering

### UI

- Sidebar filter panel

### Behavior

- Update `filters` in state
- Trigger full graph refetch

---

## Detail Panel

### Node View

- Names
- Attributes
- Relationships (list)
- Media

---

### Relationship View

- Type
- Participants + roles
- Interval summary

---

## Editing Model

### In-Graph Actions

- Connect nodes
- Create relationship

---

### Panel Editing

- Full forms:
  - entity edit
  - relationship edit
  - interval edit

---

### Mutations

Use TanStack Query mutations:

- `createEntity`
- `updateEntity`
- `createRelationship`
- `addInterval`

After mutation:
- invalidate relevant queries
- refetch graph if needed

---

## Performance Strategy

- Limit expansion depth
- Use delta updates
- Avoid full graph reloads where possible
- Debounce time slider updates (optional)

---

## Error Handling

- Display inline errors in panel
- Retry for fetch failures
- Graceful fallback for graph load failures

---

## File Structure

```
/components
  Graph/
  Panels/
  Filters/
  Controls/

/lib
  api/
  graph/
  state/

/hooks
  useGraph
  useExpandNode
  useFilters
```

---

## Design Constraints

- Graph must remain **responsive under growth**
- Avoid over-fetching
- Maintain **single source of truth for graph state**
- No duplication of graph logic outside API contract

---

## Summary

This architecture ensures:

- Clear separation of concerns
- Efficient graph updates
- Alignment with backend projection model
- Scalable interaction patterns

It is optimized for rapid iteration while maintaining long-term structure.
