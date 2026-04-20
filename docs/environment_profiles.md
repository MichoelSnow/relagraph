# Environment Profiles and Variable Contract

This document defines the runtime profiles and environment variable contract for Relagraph.

## Profiles

- `local` (development/testing on one machine)
- `prod` (deployed runtime)

`APP_ENV` controls profile selection:
- `APP_ENV=local` for local/dev
- `APP_ENV=prod` for production

When `APP_ENV` is not set, code falls back to:
- `NODE_ENV=production` -> `prod`
- otherwise -> `local`

## Variable Contract

| Variable | Required | local/dev value | prod value | Notes |
| --- | --- | --- | --- | --- |
| `APP_ENV` | Yes | `local` | `prod` | Explicit runtime profile. |
| `NODE_ENV` | Yes | `development` | `production` | Standard Next.js runtime mode. |
| `PORT` | No | `3000` | platform-provided or explicit | App server port. Defaults to `3000`. |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `http://localhost:3000` | public app/api origin | Client-visible API base URL for frontend fetch calls. |
| `POSTGRES_PORT` | No | `5433` | not used | Host port published by Docker for local Postgres. |
| `DATABASE_URL` | Yes | `postgresql://relagraph:relagraph@localhost:5433/relagraph` | secret connection string | Single DB connection variable used by both profiles. |

## Local/Dev Setup

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start Postgres with `pnpm db:up`.
3. Run migrations with `pnpm db:migrate`.
4. Start app with `pnpm dev` (or `pnpm dev:local`).

Notes:
- This project uses a single `.env` file for local/dev.
- `next` and `docker compose` both read `.env` in the project root.

Local Postgres is provided by `docker-compose.yml`:
- host: `localhost`
- port: `${POSTGRES_PORT:-5433}` on host -> `5432` in container
- db: `relagraph`
- user: `relagraph`
- password: `relagraph`

## Production Contract

Production must provide the same variable names using deployment secrets/env config:
- `APP_ENV=prod`
- `NODE_ENV=production`
- `DATABASE_URL` (managed Postgres, SSL-enabled as required)
- `NEXT_PUBLIC_API_BASE_URL` (public origin)

Application code does not branch by separate DB client implementations. Both profiles use the same `DATABASE_URL`-driven connection path.
