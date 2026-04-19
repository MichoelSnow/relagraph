import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { hashPassword } from "@/lib/auth/password"
import { getDb } from "@/db/client"
import { appUser } from "@/db/schema"
import { isJsonRequest, jsonError } from "@/server/api/http"
import { createUserSession, setSessionCookie } from "@/server/auth/session"

type RegisterRequest = {
  email?: string
  password?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isJsonRequest(request)) {
    return jsonError(415, "unsupported_media_type", "Content-Type must be application/json")
  }

  let body: RegisterRequest
  try {
    body = (await request.json()) as RegisterRequest
  } catch {
    return jsonError(400, "invalid_json", "Request body must be valid JSON")
  }

  const email = body.email?.trim().toLowerCase() ?? ""
  const password = body.password ?? ""

  if (!email || !email.includes("@")) {
    return jsonError(400, "invalid_request", "email must be valid")
  }

  if (password.length < 8) {
    return jsonError(400, "invalid_request", "password must be at least 8 characters")
  }

  const db = getDb()
  const existing = await db.select({ id: appUser.id }).from(appUser).where(eq(appUser.email, email)).limit(1)
  if (existing.length > 0) {
    return jsonError(409, "email_in_use", "An account with this email already exists")
  }

  const userId = randomUUID()
  await db.insert(appUser).values({
    id: userId,
    email,
    passwordHash: hashPassword(password)
  })

  const session = await createUserSession(userId)
  const response = NextResponse.json({
    id: userId,
    email
  }, { status: 201 })
  setSessionCookie(response, session.token, session.expiresAt)

  return response
}
