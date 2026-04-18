import { NextResponse } from "next/server"

import { asStringArray, isIsoTimestamp, isJsonRequest, jsonError } from "@/server/api/http"
import { buildGraphDeltaFromCenter } from "@/server/graph/projection"

type GraphViewRequest = {
  center_entity_id?: string
  as_of?: string
  depth?: number
  filters?: {
    entity_types?: string[]
    relationship_types?: string[]
    include_inactive?: boolean
  }
  already_loaded?: {
    entity_ids?: string[]
    relationship_ids?: string[]
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isJsonRequest(request)) {
    return jsonError(415, "unsupported_media_type", "Content-Type must be application/json")
  }

  let body: GraphViewRequest
  try {
    body = (await request.json()) as GraphViewRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  if (!body.center_entity_id?.trim()) {
    return jsonError(400, "invalid_request", "center_entity_id is required")
  }

  if (!body.as_of || !isIsoTimestamp(body.as_of)) {
    return jsonError(400, "invalid_request", "as_of must be an ISO-8601 timestamp")
  }

  if (!Number.isInteger(body.depth) || (body.depth ?? 0) < 0) {
    return jsonError(400, "invalid_request", "depth must be a non-negative integer")
  }

  const graph = await buildGraphDeltaFromCenter({
    centerEntityId: body.center_entity_id.trim(),
    alreadyLoadedEntityIds: new Set(asStringArray(body.already_loaded?.entity_ids)),
    allowedEntityKinds: body.filters?.entity_types?.length
      ? new Set(body.filters.entity_types)
      : null
  })

  if (!graph) {
    return jsonError(404, "entity_not_found", "Center entity does not exist", {
      center_entity_id: body.center_entity_id
    })
  }

  return NextResponse.json(graph)
}
