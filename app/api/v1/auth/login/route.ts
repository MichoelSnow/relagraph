import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { verifyPassword } from "@/lib/auth/password"
import { getDb } from "@/db/client"
import { appUser } from "@/db/schema"
import { isJsonRequest, jsonError } from "@/server/api/http"
import { createUserSession, setSessionCookie } from "@/server/auth/session"

type LoginRequest = {
  email?: string
  password?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isJsonRequest(request)) {
    return jsonError(415, "unsupported_media_type", "Content-Type must be application/json")
  }

  let body: LoginRequest
  try {
    body = (await request.json()) as LoginRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  const email = body.email?.trim().toLowerCase() ?? ""
  const password = body.password ?? ""

  if (!email || !password) {
    return jsonError(400, "invalid_request", "email and password are required")
  }

  const db = getDb()
  const users = await db
    .select({ id: appUser.id, email: appUser.email, passwordHash: appUser.passwordHash })
    .from(appUser)
    .where(eq(appUser.email, email))
    .limit(1)

  const user = users[0]
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return jsonError(401, "invalid_credentials", "Invalid email or password")
  }

  const session = await createUserSession(user.id)
  const response = NextResponse.json({
    id: user.id,
    email: user.email
  })
  setSessionCookie(response, session.token, session.expiresAt)

  return response
}
