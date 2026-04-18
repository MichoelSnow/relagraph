import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { entity } from "@/db/schema"
import { isJsonRequest, jsonError } from "@/server/api/http"
import type { Entity } from "@/types"

type CreateEntityRequest = {
  entity_kind?: "person" | "animal" | "place"
  display_name?: string
}

export async function POST(request: Request): Promise<NextResponse> {
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
