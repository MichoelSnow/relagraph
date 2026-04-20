import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import GraphWorkspace from "@/components/graph/GraphWorkspace"
import { getDb } from "@/db/client"
import { userGraph } from "@/db/schema"
import { requireAuthUser } from "@/server/auth/session"

type GraphPageProps = {
  params: Promise<{ graphId: string }>
}

export default async function GraphPage({ params }: GraphPageProps) {
  const { graphId } = await params
  const user = await requireAuthUser()
  const db = getDb()

  const rows = await db
    .select({
      id: userGraph.id,
      name: userGraph.name
    })
    .from(userGraph)
    .where(and(eq(userGraph.id, graphId), eq(userGraph.ownerUserId, user.id)))
    .limit(1)

  const graph = rows[0]
  if (!graph) {
    notFound()
  }

  return (
    <GraphWorkspace
      graphId={graph.id}
      graphName={graph.name}
      initialAsOf={new Date().toISOString()}
    />
  )
}
