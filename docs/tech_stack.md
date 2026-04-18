# Tech Stack

## Overview

This document defines the technology stack for the Relagraph project.

Relagraph is a **web-first, temporal relationship graph application** with:
- Graph-based visualization
- Time-aware data exploration
- Progressive node expansion
- Inline editing capabilities

The stack is optimized for:
- rapid iteration
- interactive graph rendering
- scalable backend queries
- clean separation between data model and UI projections

---

## High-Level Architecture

- **Frontend:** Next.js (React, App Router)
- **Backend API:** Node.js (Next.js API routes or separate service)
- **Database:** PostgreSQL
- **Data Access Layer:** ORM (Drizzle or Prisma)
- **Graph Visualization:** Cytoscape.js
- **State Management:** TanStack Query
- **Styling:** Tailwind CSS
- **Deployment:** Vercel (frontend) + managed Postgres

---

## Frontend

### Framework
- **Next.js (App Router)**
  - Server-rendered shell
  - Client-side interactive graph
  - Built-in routing and API support

### UI Library
- **React**

### Graph Visualization
- **Cytoscape.js**
  - Supports dynamic graphs
  - Handles medium-sized datasets well
  - Good balance of performance and flexibility

### State Management
- **TanStack Query**
  - Server state caching
  - Background refetching
  - Mutation handling

### Styling
- **Tailwind CSS**
  - Fast UI iteration
  - Utility-first styling

---

## Backend

### Runtime
- **Node.js**

### API Design

Two-layer approach:

#### 1. Graph Projection API (Read)
- Returns UI-ready subgraphs
- Handles:
  - traversal
  - filtering
  - temporal logic

#### 2. CRUD / Domain API (Write)
- Manages:
  - entities
  - relationships
  - intervals
  - events
  - media

---

## Database

### Primary Database
- **PostgreSQL**

### Why Postgres
- Strong relational model
- Supports complex joins (needed for graph traversal)
- JSONB support for extensibility
- Mature ecosystem

---

## ORM / Query Layer

Options:
- **Drizzle (preferred)** → closer to SQL, more control
- **Prisma** → easier onboarding, more abstraction

---

## Graph Data Strategy

- Store normalized relational data
- Build graph projections in backend
- Avoid client-side graph reconstruction

---

## Deployment

### Frontend
- **Vercel**
  - Easy Next.js integration
  - Fast deployment cycle

### Database
- Managed PostgreSQL (e.g., Neon, Supabase, RDS)

---

## Performance Considerations

- Use indexed queries for:
  - relationship traversal
  - temporal filtering
- Limit graph expansion depth
- Lazy-load nodes
- Cache subgraph responses

---

## Future Extensions

- Graph caching layer
- Background jobs for precomputed views
- AI services for tagging and inference
- Optional graph database integration if needed

---

## Summary

This stack provides:
- Fast iteration
- Strong data modeling
- Scalable graph querying
- Clean frontend-backend separation

It is designed to support both current needs and future expansion.
