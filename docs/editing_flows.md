# Editing Flows Mapped to API Calls

## Overview

This document defines **user editing flows** and their exact mapping to API calls.

Purpose:
- Remove ambiguity for AI implementation
- Define correct sequencing of multi-step mutations
- Ensure consistency between UI and backend

---

## Principles

- All edits happen via **CRUD/domain endpoints**
- Graph is **refetched or updated after mutations**
- Multi-step flows must follow defined order
- UI panel = source of truth for edits

---

## 1. Create Entity

### User Action
- User creates a new node

### Flow
1. POST /entities
2. (optional) POST /entity-names
3. Refresh or merge entity into graph

---

## 2. Create Relationship

### User Action
- User connects two nodes

### Flow
1. POST /relationships
2. POST /relationships/:id/intervals
3. Refetch graph (or merge delta)

---

## 3. Add Relationship Interval

### User Action
- User adds time range to relationship

### Flow
1. POST /relationships/:id/intervals
2. Refetch graph (if active at current time)

---

## 4. Edit Relationship

### User Action
- Change type, roles, metadata

### Flow
1. PATCH /relationships/:id
2. Refetch graph

---

## 5. Delete / End Relationship

### User Action
- End relationship

### Flow
1. PATCH interval (set end date)
2. Refetch graph

---

## 6. Create Event

### User Action
- Add event (e.g., wedding)

### Flow
1. POST /events
2. (optional) POST /event_relationship
3. (optional) POST /event_participant

---

## 7. Edit Entity

### User Action
- Update name or details

### Flow
1. PATCH /entities/:id
2. (optional) PATCH /entity-names/:id

---

## 8. Add Name

### User Action
- Add alternate name

### Flow
1. POST /entity-names

---

## 9. Add Media

### User Action
- Upload or link media

### Flow
1. POST /media
2. POST /media/link

---

## 10. Expand Graph After Edit

### Rule

After any mutation:
- If change affects current time slice → refetch `/graph/view`
- Otherwise → no immediate graph update needed

---

## Summary

These flows ensure:
- Correct mutation sequencing
- Consistent graph state
- Predictable UI behavior

This document is authoritative for all editing interactions.
