import { NextResponse } from "next/server"

import { getAuthUser } from "@/server/auth/session"
import { jsonError } from "@/server/api/http"

export async function GET(): Promise<NextResponse> {
  const user = await getAuthUser()
  if (!user) {
    return jsonError(401, "unauthorized", "Authentication required")
  }

  return NextResponse.json(user)
}
