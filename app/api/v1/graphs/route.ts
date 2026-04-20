import { randomUUID } from "node:crypto"

import { asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { userGraph } from "@/db/schema"
import { requireApiUser } from "@/server/api/auth"
import { isJsonRequest, jsonError } from "@/server/api/http"

type CreateGraphRequest = {
  name?: string
}

export async function GET(): Promise<NextResponse> {
  const auth = await requireApiUser()
  if (!auth.user) {
    return auth.response
  }

  const db = getDb()
  const graphs = await db
    .select({
      id: userGraph.id,
      name: userGraph.name,
      created_at: userGraph.createdAt,
      updated_at: userGraph.updatedAt
    })
    .from(userGraph)
    .where(eq(userGraph.ownerUserId, auth.user.id))
    .orderBy(asc(userGraph.createdAt))

  return NextResponse.json({ graphs })
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireApiUser()
  if (!auth.user) {
    return auth.response
  }

  if (!isJsonRequest(request)) {
    return jsonError(415, "unsupported_media_type", "Content-Type must be application/json")
  }

  let body: CreateGraphRequest
  try {
    body = (await request.json()) as CreateGraphRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  const name = body.name?.trim() ?? ""
  if (!name) {
    return jsonError(400, "invalid_request", "name is required")
  }

  const db = getDb()
  const graphId = randomUUID()
  await db.insert(userGraph).values({
    id: graphId,
    ownerUserId: auth.user.id,
    name
  })

  return NextResponse.json(
    {
      id: graphId,
      name
    },
    { status: 201 }
  )
}
