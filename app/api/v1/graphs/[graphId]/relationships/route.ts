import { randomUUID } from "node:crypto"

import { and, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { entity, relationship, relationshipParticipant, relationshipType } from "@/db/schema"
import { requireApiGraphAccess } from "@/server/api/auth"
import { isJsonRequest, jsonError } from "@/server/api/http"
import type { RelationshipParticipant } from "@/types"

type CreateRelationshipRequest = {
  relationship_type?: string
  participants?: Array<{
    entity_id?: string
    role?: string
  }>
}

type RouteContext = {
  params: Promise<{ graphId: string }>
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { graphId } = await context.params
  const auth = await requireApiGraphAccess(graphId)
  if (!auth.user) {
    return auth.response
  }

  if (!isJsonRequest(request)) {
    return jsonError(415, "unsupported_media_type", "Content-Type must be application/json")
  }

  let body: CreateRelationshipRequest
  try {
    body = (await request.json()) as CreateRelationshipRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  if (!body.relationship_type?.trim()) {
    return jsonError(400, "invalid_request", "relationship_type is required")
  }

  if (!Array.isArray(body.participants) || body.participants.length < 2) {
    return jsonError(400, "invalid_request", "participants must contain at least two items")
  }

  const participantInputs = body.participants
    .map((participant) => ({
      entityId: participant.entity_id?.trim() ?? "",
      role: participant.role?.trim() ?? ""
    }))
    .filter((participant) => participant.entityId.length > 0 && participant.role.length > 0)

  if (participantInputs.length < 2) {
    return jsonError(
      400,
      "invalid_request",
      "participants must include entity_id and role for at least two items"
    )
  }

  const db = getDb()
  const relationshipTypeCode = body.relationship_type.trim()

  const [typeRecord] = await db
    .select({ id: relationshipType.id })
    .from(relationshipType)
    .where(eq(relationshipType.code, relationshipTypeCode))
    .limit(1)

  if (!typeRecord) {
    return jsonError(
      400,
      "relationship_type_not_found",
      "relationship_type must reference an existing relationship_type.code",
      { relationship_type: relationshipTypeCode }
    )
  }

  const participantEntityIds = [...new Set(participantInputs.map((participant) => participant.entityId))]
  const existingEntities = await db
    .select({ id: entity.id })
    .from(entity)
    .where(inArray(entity.id, participantEntityIds))

  if (existingEntities.length !== participantEntityIds.length) {
    return jsonError(400, "invalid_participants", "All participants must reference existing entities")
  }

  const graphScopedEntities = await db
    .select({ id: entity.id })
    .from(entity)
    .where(and(inArray(entity.id, participantEntityIds), eq(entity.graphId, graphId)))

  if (graphScopedEntities.length !== participantEntityIds.length) {
    return jsonError(400, "invalid_participants", "Participants must belong to the selected graph")
  }

  const relationshipId = randomUUID()

  await db.transaction(async (tx) => {
    await tx.insert(relationship).values({
      id: relationshipId,
      graphId,
      relationshipTypeId: typeRecord.id
    })

    await tx.insert(relationshipParticipant).values(
      participantInputs.map((participant) => ({
        id: randomUUID(),
        relationshipId,
        entityId: participant.entityId,
        roleInRelationship: participant.role
      }))
    )
  })

  const participants: RelationshipParticipant[] = participantInputs.map((participant) => ({
    relationship_id: relationshipId,
    entity_id: participant.entityId,
    role: participant.role
  }))

  return NextResponse.json(
    {
      id: relationshipId,
      relationship_type: relationshipTypeCode,
      participants
    },
    { status: 201 }
  )
}
