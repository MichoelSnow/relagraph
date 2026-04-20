# Graph Projection Contract

## Overview

This document defines the **Graph Projection API contract** for Relagraph.

This contract specifies how the backend returns a **UI-ready, time-resolved subgraph** for the frontend graph explorer.

It is the **authoritative definition** of:
- how graph data is filtered
- how time is applied
- how traversal works
- what shape the frontend receives

---

## Core Principles

- Return **UI-ready graph data** (no client-side interval resolution)
- Include **only active relationships at time T**
- Apply **filters before traversal**
- Return **incremental (delta) updates**
- Ensure **global deduplication**
- Provide **no layout or positioning data**

---

## Endpoint: View Graph

### Request

```json
POST /api/v1/graphs/:graphId/graph/view

{
  "center_entity_id": "uuid",
  "as_of": "2024-06-01T00:00:00Z",
  "depth": 1,
  "filters": {
    "entity_types": ["person", "animal", "place"],
    "relationship_types": ["romantic", "familial"],
    "include_inactive": false
  },
  "already_loaded": {
    "entity_ids": [],
    "relationship_ids": []
  }
}
```

---

## Response

```json
{
  "entities": [
    {
      "id": "uuid",
      "entity_kind": "person",
      "display_name": "Alex"
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "relationship_type": "romantic",
      "from_entity_id": "uuid",
      "to_entity_id": "uuid",
      "roles": {
        "from": "partner",
        "to": "partner"
      },
      "active": true,
      "start": "2020-01-01T00:00:00Z",
      "end": null
    }
  ],
  "meta": {
    "truncated": false,
    "node_count": 1,
    "edge_count": 1
  }
}
```

---

## Semantics

### Time Resolution

Only relationships active at `as_of` are returned.

A relationship is **active** if:

- `start <= as_of`
- `end IS NULL OR end >= as_of`

All intervals are resolved server-side into a single active edge.

---

### Filtering

Filters are applied **before traversal**:

- `entity_types` filters nodes
- `relationship_types` filters edges
- `include_inactive = false` removes inactive relationships

---

### Traversal

- Begins at `center_entity_id`
- Expands outward up to `depth` hops
- Only traverses edges that pass filters
- Traversal is constrained to entities/relationships in `:graphId`

---

### Delta Behavior

The response returns only **new graph elements**:

- Entities not in `already_loaded.entity_ids`
- Relationships not in `already_loaded.relationship_ids`

This enables efficient incremental graph expansion.

---

### Deduplication

- Each entity appears only once per response
- Each relationship appears only once per response

---

### Truncation

If graph limits are exceeded:

```json
"meta": {
  "truncated": true
}
```

Backend may enforce limits on:
- node count
- edge count
- traversal depth

---

### Layout

- No layout or positioning data is returned
- Layout is fully handled by the frontend

---

## Data Model (UI-Ready)

### Entity

```json
{
  "id": "uuid",
  "entity_kind": "person | animal | place",
  "display_name": "string"
}
```

---

### Edge (Resolved Relationship)

```json
{
  "id": "uuid",
  "relationship_type": "string",
  "from_entity_id": "uuid",
  "to_entity_id": "uuid",
  "roles": {
    "from": "string",
    "to": "string"
  },
  "active": true,
  "start": "ISO timestamp",
  "end": "ISO timestamp | null"
}
```

---

## Notes

- Events are **not included in graph view (v1)**
- Full relationship history is handled via separate endpoints
- Expand endpoint uses the same contract shape at `POST /api/v1/graphs/:graphId/graph/expand`
- This contract is optimized for:
  - graph rendering
  - expansion
  - time-based filtering
