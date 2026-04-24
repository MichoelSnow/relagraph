import { NextResponse } from "next/server"

import { buildGraphDeltaFromCenter, toFamilyViewGraph } from "@/server/graph/projection"
import { asStringArray, isIsoTimestamp, isJsonRequest, jsonError } from "@/server/api/http"

type ViewMode = "graph" | "family"

type GraphProjectionRequestBody = {
  center_entity_id?: string
  entity_id?: string
  view_mode?: ViewMode
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

type GraphProjectionEntityField = "center_entity_id" | "entity_id"

type HandleGraphProjectionOptions = {
  request: Request
  graphId: string
  entityField: GraphProjectionEntityField
  entityMissingMessage: string
  entityNotFoundMessage: string
}

function isVirtualFamilyEntityId(value: string): boolean {
  return value.startsWith("family:")
}

export async function handleGraphProjectionRequest(
  options: HandleGraphProjectionOptions
): Promise<NextResponse> {
  const { request, graphId, entityField, entityMissingMessage, entityNotFoundMessage } = options

  if (!isJsonRequest(request)) {
    return jsonError(415, "unsupported_media_type", "Content-Type must be application/json")
  }

  let body: GraphProjectionRequestBody
  try {
    body = (await request.json()) as GraphProjectionRequestBody
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  const centerEntityId = body[entityField]?.trim()
  if (!centerEntityId) {
    return jsonError(400, "invalid_request", entityMissingMessage)
  }

  if (!body.as_of || !isIsoTimestamp(body.as_of)) {
    return jsonError(400, "invalid_request", "as_of must be an ISO-8601 timestamp")
  }

  if (!Number.isInteger(body.depth) || (body.depth ?? 0) < 0) {
    return jsonError(400, "invalid_request", "depth must be a non-negative integer")
  }

  const viewMode = body.view_mode ?? "graph"
  if (viewMode !== "graph" && viewMode !== "family") {
    return jsonError(400, "invalid_request", "view_mode must be one of: graph, family")
  }

  if (isVirtualFamilyEntityId(centerEntityId)) {
    return NextResponse.json({
      entities: [],
      edges: [],
      meta: {
        truncated: false,
        node_count: 0,
        edge_count: 0
      }
    })
  }

  const alreadyLoadedEntityIds = new Set(asStringArray(body.already_loaded?.entity_ids))
  const alreadyLoadedRelationshipIds = new Set(asStringArray(body.already_loaded?.relationship_ids))

  const graph = await buildGraphDeltaFromCenter({
    graphId,
    centerEntityId,
    asOf: body.as_of,
    depth: body.depth ?? 0,
    alreadyLoadedEntityIds,
    alreadyLoadedRelationshipIds,
    allowedEntityKinds: body.filters?.entity_types?.length
      ? new Set(asStringArray(body.filters.entity_types))
      : null,
    allowedRelationshipTypes: body.filters?.relationship_types?.length
      ? new Set(asStringArray(body.filters.relationship_types))
      : null,
    includeInactive: body.filters?.include_inactive === true
  })

  if (!graph) {
    return jsonError(404, "entity_not_found", entityNotFoundMessage, {
      [entityField]: body[entityField]
    })
  }

  const responseGraph =
    viewMode === "family"
      ? toFamilyViewGraph(graph, alreadyLoadedEntityIds, alreadyLoadedRelationshipIds)
      : graph

  return NextResponse.json(responseGraph)
}
