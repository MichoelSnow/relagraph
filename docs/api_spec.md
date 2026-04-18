# API Specification

## Overview

Defines the v1 HTTP API for Relagraph.

Principles:
- Graph reads via **projection endpoints**
- Writes via **domain/CRUD endpoints**
- JSON only

Base Path:
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

---

# Graph Projection (Read)

## POST /graph/view

### Purpose
Return a **UI-ready, time-resolved subgraph** around a center entity.

### Request
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

### Response
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

## POST /graph/expand

### Purpose
Expand a node within an existing graph.

### Request
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

### Response
Same shape as `/graph/view` (delta only)

---

# Entities

## POST /entities
Create entity

```json
{
  "entity_kind": "person",
  "display_name": "Alex"
}
```

## GET /entities/:id
Get entity

## PATCH /entities/:id
Update entity

---

# Relationships

## POST /relationships

```json
{
  "relationship_type": "romantic",
  "participants": [
    { "entity_id": "uuid", "role": "partner" },
    { "entity_id": "uuid", "role": "partner" }
  ]
}
```

## PATCH /relationships/:id
Update relationship metadata

---

# Relationship Intervals

## POST /relationships/:id/intervals

```json
{
  "start": "2020-01-01T00:00:00Z",
  "end": null
}
```

## PATCH /intervals/:id
Update interval

## DELETE /intervals/:id
Remove interval

---

# Events

## POST /events

```json
{
  "event_type": "wedding",
  "start": "2024-01-01T00:00:00Z"
}
```

## PATCH /events/:id

---

# Names

## POST /entity-names

```json
{
  "entity_id": "uuid",
  "name_text": "Alex",
  "name_type": "chosen"
}
```

## PATCH /entity-names/:id

---

# Media

## POST /media

```json
{
  "media_type": "photo",
  "url": "string"
}
```

## POST /media/link

```json
{
  "media_id": "uuid",
  "subject_type": "entity",
  "subject_id": "uuid"
}
```

---

# Notes

- Graph endpoints are the **primary read interface**
- CRUD endpoints are used for **editing and mutation**
- Events are **not included in graph projection (v1)**
- All graph semantics defined in **Graph Projection Contract**
