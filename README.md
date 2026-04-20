# Relagraph

Initial implementation of Relagraph: a temporal relationship graph app with a Next.js frontend, API routes, and PostgreSQL backend.

## Source Of Truth

All product and implementation behavior is defined in `/docs`:

- `docs/api_spec.md`
- `docs/graph_projection_contract.md`
- `docs/canonical_dtos.md`
- `docs/sql_schema.md`
- `docs/editing_flows.md`
- `docs/frontend_architecture.md`
- `docs/ui_framework.md`
- `docs/tech_stack.md`
- `docs/relationship_graph_schema.md`
- `docs/build_plan_checklist.md`

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- TanStack Query
- Cytoscape
- PostgreSQL
- Drizzle ORM / Drizzle Kit
- pnpm

## Prerequisites

- Node.js 22+
- Corepack enabled (`corepack enable`)
- Docker + Docker Compose

## Local Development

This repo uses a single `.env` file at project root.

Current local DB defaults:
- Docker Postgres exposed on host `5433`
- `DATABASE_URL=postgresql://relagraph:relagraph@localhost:5433/relagraph`

Start local services:

```bash
pnpm install
pnpm db:up
pnpm dev
```

Open: `http://localhost:3000`

Stop local DB:

```bash
pnpm db:down
```

View DB logs:

```bash
pnpm db:logs
```

## Database Migrations

Drizzle commands:

```bash
pnpm db:generate
pnpm db:migrate
```

Note: full schema + migrations are implemented in checklist Phase 3.

## Useful Commands

```bash
pnpm typecheck
pnpm build
pnpm lint
```

## Project Structure

```text
app/         Next.js App Router pages/layouts
components/  UI components
lib/         Shared utilities (including env helpers)
server/      Backend domain/services (to be implemented)
db/          DB client, schema, and migrations
types/       Canonical DTO/type definitions
docs/        Product and engineering specs + build checklist
```
