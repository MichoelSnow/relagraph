import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { getDatabaseUrl } from "@/lib/env"
import * as schema from "@/db/schema"

declare global {
  var relagraphPgPool: Pool | undefined
}

export function getPgPool(): Pool {
  if (!global.relagraphPgPool) {
    global.relagraphPgPool = new Pool({
      connectionString: getDatabaseUrl()
    })
  }

  return global.relagraphPgPool
}

export async function closePgPool(): Promise<void> {
  if (!global.relagraphPgPool) {
    return
  }

  await global.relagraphPgPool.end()
  global.relagraphPgPool = undefined
}

export function getDb() {
  return drizzle(getPgPool(), { schema })
}
