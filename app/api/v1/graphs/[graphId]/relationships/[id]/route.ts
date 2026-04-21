import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { relationship, relationshipParticipant, relationshipType } from "@/db/schema"
import { requireApiGraphAccess } from "@/server/api/auth"
import { requireCsrfProtection } from "@/server/api/csrf"
import { isJsonRequest, jsonError } from "@/server/api/http"
import type { RelationshipParticipant } from "@/types"

type UpdateRelationshipRequest = {
  relationship_type?: string
  participants?: Array<{
    entity_id?: string
    role?: string
  }>
}

type RouteContext = {
  params: Promise<{ graphId: string; id: string }>
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

function normalizeRelationshipTypeCode(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
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

  let body: UpdateRelationshipRequest
  try {
    body = (await request.json()) as UpdateRelationshipRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  const db = getDb()

  const [existing] = await db
    .select({ id: relationship.id })
    .from(relationship)
    .where(and(eq(relationship.id, id), eq(relationship.graphId, graphId)))
    .limit(1)

  if (!existing) {
    return jsonError(404, "relationship_not_found", "Relationship not found", { id })
  }

  if (body.relationship_type?.trim()) {
    const code = body.relationship_type.trim()
    let [typeRecord] = await db
      .select({ id: relationshipType.id })
      .from(relationshipType)
      .where(eq(relationshipType.code, code))
      .limit(1)

    if (!typeRecord) {
      const normalizedCode = normalizeRelationshipTypeCode(code)
      const preset = RELATIONSHIP_TYPE_PRESETS[normalizedCode]
      if (preset) {
        await db
          .insert(relationshipType)
          .values({
            id: randomUUID(),
            code: normalizedCode,
            displayName: preset.displayName,
            isDirected: preset.isDirected,
            category: preset.category,
            allowsMultipleParticipants: false
          })
          .onConflictDoNothing()

        ;[typeRecord] = await db
          .select({ id: relationshipType.id })
          .from(relationshipType)
          .where(eq(relationshipType.code, normalizedCode))
          .limit(1)
      }
    }

    if (!typeRecord) {
      return jsonError(400, "relationship_type_not_found", "Unknown relationship_type", {
        relationship_type: code
      })
    }

    await db
      .update(relationship)
      .set({ relationshipTypeId: typeRecord.id })
      .where(eq(relationship.id, id))
  }

  if (Array.isArray(body.participants) && body.participants.length > 0) {
    for (const participant of body.participants) {
      const entityId = participant.entity_id?.trim()
      const role = participant.role?.trim()
      if (!entityId || !role) {
        return jsonError(400, "invalid_request", "participants entries require entity_id and role")
      }

      const [updatedParticipant] = await db
        .update(relationshipParticipant)
        .set({ roleInRelationship: role })
        .where(
          and(
            eq(relationshipParticipant.relationshipId, id),
            eq(relationshipParticipant.entityId, entityId)
          )
        )
        .returning({
          relationship_id: relationshipParticipant.relationshipId,
          entity_id: relationshipParticipant.entityId,
          role: relationshipParticipant.roleInRelationship
        })

      if (!updatedParticipant) {
        return jsonError(
          400,
          "invalid_participants",
          "Participant does not belong to relationship",
          { entity_id: entityId }
        )
      }
    }
  }

  const [relationshipRow] = await db
    .select({
      id: relationship.id,
      relationship_type: relationshipType.code
    })
    .from(relationship)
    .innerJoin(relationshipType, eq(relationship.relationshipTypeId, relationshipType.id))
    .where(eq(relationship.id, id))
    .limit(1)

  const participantRows = await db
    .select({
      relationship_id: relationshipParticipant.relationshipId,
      entity_id: relationshipParticipant.entityId,
      role: relationshipParticipant.roleInRelationship
    })
    .from(relationshipParticipant)
    .where(eq(relationshipParticipant.relationshipId, id))

  return NextResponse.json(
    {
      id,
      relationship_type: relationshipRow?.relationship_type ?? "",
      participants: participantRows as RelationshipParticipant[]
    },
    { status: 200 }
  )
}
