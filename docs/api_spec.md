# API Specification

## Overview

Defines the implemented v1 HTTP API for Relagraph.

Principles:
- JSON-only API
- Cookie-based authentication for protected routes
- Graph-scoped reads and writes (`/graphs/:graphId/...`)

Base path:
`/api/v1`

---

## Common

### Content Type
`application/json`

### Error Format
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

### Auth
- Session cookie is set by auth endpoints.
- Protected endpoints return `401` when no valid session exists.
- Graph-scoped endpoints return `404` when graph access is denied/not found.
- State-changing endpoints require an `Origin` header that matches the request host (CSRF protection).
- Public write endpoints are rate limited and may return `429` with a `Retry-After` header.

---

## Auth

### `next-auth` routes (`/api/auth/*`)
Session authentication is handled by NextAuth credentials provider.

Used routes:
- `POST /api/auth/callback/credentials` (login via credentials)
- `POST /api/auth/signout` (logout)
- `GET /api/auth/session` (session inspection)

### POST `/auth/register`
Create a user account.

Request:
```json
{
  "username": "user@example.com-or-handle",
  "password": "min-8-chars"
}
```

Response (`201`):
```json
{
  "id": "uuid",
  "username": "user@example.com-or-handle"
}
```

### GET `/auth/me`
Get current authenticated user.

Response (`200`):
```json
{
  "id": "uuid",
  "username": "user@example.com-or-handle"
}
```

---

## Graphs

### GET `/graphs`
List graphs owned by authenticated user.

Response (`200`):
```json
{
  "graphs": [
    {
      "id": "uuid",
      "name": "Family Graph",
      "created_at": "ISO timestamp",
      "updated_at": "ISO timestamp"
    }
  ]
}
```

### POST `/graphs`
Create a graph owned by authenticated user.

Request:
```json
{
  "name": "Family Graph"
}
```

Response (`201`):
```json
{
  "id": "uuid",
  "name": "Family Graph"
}
```

---

## Graph Projection (Read)

### POST `/graphs/:graphId/graph/view`
Return UI-ready, time-resolved graph delta around a center entity.

Request:
```json
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

Response (`200`):
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
      "roles": { "from": "partner", "to": "partner" },
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

### POST `/graphs/:graphId/graph/expand`
Expand from an entity within the same graph; response shape matches `/graph/view`.

Request:
```json
{
  "entity_id": "uuid",
  "as_of": "2024-06-01T00:00:00Z",
  "depth": 1,
  "filters": {},
  "already_loaded": {
    "entity_ids": [],
    "relationship_ids": []
  }
}
```

---

## Entities

### GET `/graphs/:graphId/entities`
List entities for one graph.

### POST `/graphs/:graphId/entities`
Create entity in one graph.

Request:
```json
{
  "entity_kind": "person",
  "display_name": "Alex"
}
```

Response (`201`):
```json
{
  "id": "uuid",
  "entity_kind": "person",
  "display_name": "Alex"
}
```

### PATCH `/graphs/:graphId/entities/:id`
Update editable entity fields in one graph.

Request:
```json
{
  "display_name": "Alex Updated",
  "entity_kind": "person"
}
```

### GET `/graphs/:graphId/entities/:id`
Get one entity detail in one graph.

Response (`200`):
```json
{
  "id": "uuid",
  "entity_kind": "person",
  "display_name": "Alex",
  "entity_name": {
    "name_text": "Alex",
    "name_type": "legal",
    "language_code": "en",
    "script_code": null,
    "notes": null,
    "is_primary": true,
    "sort_order": null,
    "start_date": null,
    "end_date": null
  },
  "entity_names": [],
  "profile": {}
}
```

### DELETE `/graphs/:graphId/entities/:id`
Delete one entity in one graph. Connected relationships are also removed.

Response (`200`):
```json
{
  "ok": true
}
```

---

## Relationships

### POST `/graphs/:graphId/relationships`
Create relationship in one graph.

Request:
```json
{
  "relationship_type": "romantic",
  "participants": [
    { "entity_id": "uuid", "role": "partner" },
    { "entity_id": "uuid", "role": "partner" }
  ]
}
```

Response (`201`):
```json
{
  "id": "uuid",
  "relationship_type": "romantic",
  "participants": [
    { "relationship_id": "uuid", "entity_id": "uuid", "role": "partner" }
  ]
}
```

### POST `/graphs/:graphId/relationships/:id/intervals`
Create relationship interval.

Request:
```json
{
  "start": "2020-01-01T00:00:00Z",
  "end": null
}
```

Response (`201`):
```json
{
  "id": "uuid",
  "relationship_id": "uuid",
  "start": "2020-01-01T00:00:00Z",
  "end": null
}
```

### PATCH `/graphs/:graphId/relationships/:id`
Update relationship type and participant roles in one graph.

Request:
```json
{
  "relationship_type": "familial",
  "participants": [
    { "entity_id": "uuid", "role": "parent" },
    { "entity_id": "uuid", "role": "child" }
  ]
}
```

---

## Notes

- Unscoped legacy endpoints (`/entities`, `/relationships`, `/graph/view`, etc.) are removed.
- Graph projection behavior is defined in `graph_projection_contract.md`.
