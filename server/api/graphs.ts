import { and, eq } from "drizzle-orm"

import { getDb } from "@/db/client"
import { userGraph } from "@/db/schema"

export type GraphSummary = {
  id: string
  name: string
}

export async function getOwnedGraphSummary(graphId: string, userId: string): Promise<GraphSummary | null> {
  const db = getDb()
  const rows = await db
    .select({
      id: userGraph.id,
      name: userGraph.name
    })
    .from(userGraph)
    .where(and(eq(userGraph.id, graphId), eq(userGraph.ownerUserId, userId)))
    .limit(1)

  return rows[0] ?? null
}
