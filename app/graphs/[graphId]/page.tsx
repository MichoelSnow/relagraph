import { notFound } from "next/navigation"

import GraphWorkspace from "@/components/graph/GraphWorkspace"
import { getOwnedGraphSummary } from "@/server/api/graphs"
import { requireAuthUser } from "@/server/auth/session"

export const dynamic = "force-dynamic"

type GraphPageProps = {
  params: Promise<{ graphId: string }>
}

export default async function GraphPage({ params }: GraphPageProps) {
  const { graphId } = await params
  const user = await requireAuthUser()
  const graph = await getOwnedGraphSummary(graphId, user.id)
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
