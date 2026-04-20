# Editing Flows Mapped to API Calls

## Overview

This document defines **user editing flows** and their exact mapping to API calls.

Purpose:
- Remove ambiguity for AI implementation
- Define correct sequencing of multi-step mutations
- Ensure consistency between UI and backend

---

## Principles

- All edits happen via **graph-scoped endpoints**
- Graph is **refetched or updated after mutations**
- Multi-step flows must follow defined order
- UI panel = source of truth for edits

---

## 1. Authenticate User

### User Action
- User logs in or registers

### Flow
1. POST `/auth/login` or POST `/auth/register`
2. GET `/auth/me` to hydrate session state
3. GET `/graphs` to load graph list

---

## 2. Create Graph

### User Action
- User creates a new graph from graph list page

### Flow
1. POST `/graphs`
2. GET `/graphs` (or merge response into list state)
3. Navigate to `/graphs/:graphId`

---

## 3. Create Entity

### User Action
- User creates a new node

### Flow
1. POST `/graphs/:graphId/entities`
3. Refresh or merge entity into graph

---

## 4. Create Relationship

### User Action
- User connects two nodes

### Flow
1. POST `/graphs/:graphId/relationships`
2. POST `/graphs/:graphId/relationships/:id/intervals`
3. Refetch graph (or merge delta)

---

## 5. Add Relationship Interval

### User Action
- User adds time range to relationship

### Flow
1. POST `/graphs/:graphId/relationships/:id/intervals`
2. Refetch graph (if active at current time)

---

## 6. Expand Graph After Edit

### Rule

After any mutation:
- If change affects current time slice → refetch `/graphs/:graphId/graph/view`
- Otherwise → no immediate graph update needed

---

## Summary

These flows ensure:
- Correct mutation sequencing
- Consistent graph state
- Predictable UI behavior

This document is authoritative for all editing interactions.
