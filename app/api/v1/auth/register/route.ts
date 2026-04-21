import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { hashPassword } from "@/lib/auth/password"
import { getDb } from "@/db/client"
import { appUser } from "@/db/schema"
import { requireCsrfProtection } from "@/server/api/csrf"
import { isJsonRequest, jsonError } from "@/server/api/http"
import { enforceRateLimitByRequest } from "@/server/api/rate_limit"

type RegisterRequest = {
  username?: string
  password?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  const csrfError = requireCsrfProtection(request)
  if (csrfError) {
    return csrfError
  }
  const rateLimitError = enforceRateLimitByRequest(request, {
    scope: "auth:register",
    limit: 5,
    windowMs: 10 * 60_000
  })
  if (rateLimitError) {
    return rateLimitError
  }

  if (!isJsonRequest(request)) {
    return jsonError(415, "unsupported_media_type", "Content-Type must be application/json")
  }

  let body: RegisterRequest
  try {
    body = (await request.json()) as RegisterRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  const username = body.username?.trim().toLowerCase() ?? ""
  const password = body.password ?? ""

  if (!username) {
    return jsonError(400, "invalid_request", "username is required")
  }

  if (password.length < 8) {
    return jsonError(400, "invalid_request", "password must be at least 8 characters")
  }

  const db = getDb()
  const existing = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(appUser.email, username))
    .limit(1)
  if (existing.length > 0) {
    return jsonError(409, "username_in_use", "An account with this username already exists")
  }

  const userId = randomUUID()
  await db.insert(appUser).values({
    id: userId,
    email: username,
    passwordHash: hashPassword(password)
  })

  return NextResponse.json(
    {
      id: userId,
      username
    },
    { status: 201 }
  )
}
