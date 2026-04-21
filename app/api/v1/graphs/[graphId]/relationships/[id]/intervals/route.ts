import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { relationship, relationshipInterval } from "@/db/schema"
import { requireApiGraphAccess } from "@/server/api/auth"
import { requireCsrfProtection } from "@/server/api/csrf"
import { isIsoTimestamp, isJsonRequest, jsonError } from "@/server/api/http"
import type { RelationshipInterval } from "@/types"

type CreateRelationshipIntervalRequest = {
  start?: string
  end?: string | null
}

type RouteContext = {
  params: Promise<{ graphId: string; id: string }>
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const csrfError = requireCsrfProtection(request)
  if (csrfError) {
    return csrfError
  }

  const { graphId, id } = await context.params
  const auth = await requireApiGraphAccess(graphId)
  if (!auth.user) {
    return auth.response
  }

  if (!isJsonRequest(request)) {
    return jsonError(415, "unsupported_media_type", "Content-Type must be application/json")
  }

  let body: CreateRelationshipIntervalRequest
  try {
    body = (await request.json()) as CreateRelationshipIntervalRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  if (!body.start || !isIsoTimestamp(body.start)) {
    return jsonError(400, "invalid_request", "start must be an ISO-8601 timestamp")
  }

  if (body.end !== null && body.end !== undefined && !isIsoTimestamp(body.end)) {
    return jsonError(400, "invalid_request", "end must be null or an ISO-8601 timestamp")
  }

  const db = getDb()

  const [relationshipRecord] = await db
    .select({ id: relationship.id })
    .from(relationship)
    .where(and(eq(relationship.id, id), eq(relationship.graphId, graphId)))
    .limit(1)

  if (!relationshipRecord) {
    return jsonError(404, "relationship_not_found", "Relationship does not exist", { id })
  }

  const intervalId = randomUUID()

  await db.insert(relationshipInterval).values({
    id: intervalId,
    relationshipId: relationshipRecord.id,
    validFrom: body.start,
    validTo: body.end ?? null
  })

  const response: RelationshipInterval = {
    id: intervalId,
    relationship_id: relationshipRecord.id,
    start: body.start,
    end: body.end ?? null
  }

  return NextResponse.json(response, { status: 201 })
}
