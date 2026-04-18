# Canonical Data Shapes / DTOs

## Overview

This document defines the **canonical data shapes (DTOs)** used across Relagraph.

Goals:
- Provide a **single source of truth** for all data exchanged between backend and frontend
- Ensure **consistency across endpoints**
- Eliminate ambiguity for AI-assisted implementation

Rule:
> All API endpoints MUST use these shapes. No endpoint defines custom variants.

---

## Conventions

- All IDs are UUID strings
- All timestamps are ISO 8601 strings (UTC)
- Optional fields are explicitly nullable (`null`) or omitted
- Enums are string unions

---

## Core Types

### Entity

```ts
type Entity = {
  id: string
  entity_kind: "person" | "animal" | "place"
  display_name: string
}
```

---

### Edge (Resolved Relationship)

```ts
type Edge = {
  id: string
  relationship_type: string
  from_entity_id: string
  to_entity_id: string
  roles: {
    from: string
    to: string
  }
  active: boolean
  start: string
  end: string | null
}
```

---

### RelationshipParticipant

```ts
type RelationshipParticipant = {
  relationship_id: string
  entity_id: string
  role: string
}
```

---

### RelationshipInterval

```ts
type RelationshipInterval = {
  id: string
  relationship_id: string
  start: string
  end: string | null
}
```

---

### Event

```ts
type Event = {
  id: string
  event_type: string
  start: string
  end?: string | null
}
```

---

### Name

```ts
type Name = {
  id: string
  entity_id: string
  name_text: string
  name_type: string
  language_code?: string | null
  start?: string | null
  end?: string | null
}
```

---

### Media

```ts
type Media = {
  id: string
  media_type: string
  url: string
}
```

---

## Graph Response

```ts
type GraphResponse = {
  entities: Entity[]
  edges: Edge[]
  meta: {
    truncated: boolean
    node_count: number
    edge_count: number
  }
}
```

---

## Notes

- `Edge` is **pre-resolved** (intervals already applied)
- `RelationshipInterval` is used only in detail/edit flows
- `Event` is not included in graph projection (v1)
- `Entity` is intentionally minimal; details fetched separately

---

## Design Guarantees

- No duplicate entities in a response
- No duplicate edges in a response
- All edges reference valid entities
- GraphResponse is always UI-ready

---

## Summary

This document ensures:
- Consistent data contracts
- Simplified frontend logic
- Reliable AI-assisted development

It is the canonical reference for all data shapes in the system.
