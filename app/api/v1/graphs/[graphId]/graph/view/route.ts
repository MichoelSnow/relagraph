import { requireApiGraphAccess } from "@/server/api/auth"
import { handleGraphProjectionRequest } from "@/server/api/graph_projection"
import type { NextResponse } from "next/server"

type RouteContext = {
  params: Promise<{ graphId: string }>
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { graphId } = await context.params
  const auth = await requireApiGraphAccess(graphId)
  if (!auth.user) {
    return auth.response
  }

  return handleGraphProjectionRequest({
    request,
    graphId,
    entityField: "center_entity_id",
    entityMissingMessage: "center_entity_id is required",
    entityNotFoundMessage: "Center entity does not exist"
  })
}
