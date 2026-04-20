import { randomUUID } from "node:crypto"

import { asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { entity } from "@/db/schema"
import { requireApiGraphAccess } from "@/server/api/auth"
import { requireCsrfProtection } from "@/server/api/csrf"
import { isJsonRequest, jsonError } from "@/server/api/http"
import type { Entity } from "@/types"

type CreateEntityRequest = {
  entity_kind?: "person" | "animal" | "place"
  display_name?: string
}

type RouteContext = {
  params: Promise<{ graphId: string }>
}

export async function GET(_: Request, context: RouteContext): Promise<NextResponse> {
  const { graphId } = await context.params
  const auth = await requireApiGraphAccess(graphId)
  if (!auth.user) {
    return auth.response
  }

  const db = getDb()
  const entities = await db
    .select({
      id: entity.id,
      entity_kind: entity.entityKind,
      display_name: entity.canonicalDisplayName
    })
    .from(entity)
    .where(eq(entity.graphId, graphId))
    .orderBy(asc(entity.canonicalDisplayName))

  return NextResponse.json({ entities })
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

  let body: CreateEntityRequest
  try {
    body = (await request.json()) as CreateEntityRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  if (!body.entity_kind || !body.display_name?.trim()) {
    return jsonError(400, "invalid_request", "entity_kind and display_name are required")
  }

  const db = getDb()
  const id = randomUUID()
  const displayName = body.display_name.trim()

  await db.insert(entity).values({
    id,
    graphId,
    entityKind: body.entity_kind,
    canonicalDisplayName: displayName
  })

  const response: Entity = {
    id,
    entity_kind: body.entity_kind,
    display_name: displayName
  }

  return NextResponse.json(response, { status: 201 })
}
