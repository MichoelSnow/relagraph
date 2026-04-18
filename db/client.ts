import { Pool } from "pg"

import { getDatabaseUrl } from "@/lib/env"

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
