import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { clearSessionCookie, revokeSessionByToken, SESSION_COOKIE_NAME } from "@/server/auth/session"

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await revokeSessionByToken(token)
  }

  const response = NextResponse.json({ ok: true })
  clearSessionCookie(response)
  return response
}
