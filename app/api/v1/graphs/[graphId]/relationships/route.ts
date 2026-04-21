import { randomUUID } from "node:crypto"

import { and, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { entity, relationship, relationshipParticipant, relationshipType } from "@/db/schema"
import { normalizeRelationshipTypeCode } from "@/lib/graph/relationshipType"
import { requireApiGraphAccess } from "@/server/api/auth"
import { requireCsrfProtection } from "@/server/api/csrf"
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

const RELATIONSHIP_TYPE_PRESETS: Record<
  string,
  { displayName: string; isDirected: boolean; category: string | null }
> = {
  parent_child: { displayName: "Parent-Child", isDirected: true, category: "family" },
  romantic: { displayName: "Romantic", isDirected: false, category: "relationship" },
  animal: { displayName: "Animal", isDirected: false, category: "animal" },
  sibling: { displayName: "Sibling", isDirected: false, category: "family" }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const csrfError = requireCsrfProtection(request)
  if (csrfError) {
    return csrfError
  }

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
  const normalizedTypeCode = normalizeRelationshipTypeCode(relationshipTypeCode)

  let resolvedRelationshipTypeCode = relationshipTypeCode
  let [typeRecord] = await db
    .select({ id: relationshipType.id })
    .from(relationshipType)
    .where(eq(relationshipType.code, relationshipTypeCode))
    .limit(1)

  if (!typeRecord) {
    const preset = RELATIONSHIP_TYPE_PRESETS[normalizedTypeCode]
    if (preset) {
      await db
        .insert(relationshipType)
        .values({
          id: randomUUID(),
          code: normalizedTypeCode,
          displayName: preset.displayName,
          isDirected: preset.isDirected,
          category: preset.category,
          allowsMultipleParticipants: false
        })
        .onConflictDoNothing()

      ;[typeRecord] = await db
        .select({ id: relationshipType.id })
        .from(relationshipType)
        .where(eq(relationshipType.code, normalizedTypeCode))
        .limit(1)
      if (typeRecord) {
        resolvedRelationshipTypeCode = normalizedTypeCode
      }
    }
  }

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
      relationship_type: resolvedRelationshipTypeCode,
      participants
    },
    { status: 201 }
  )
}
