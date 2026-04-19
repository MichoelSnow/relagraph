import type { NextResponse } from "next/server"

import type { AuthUser } from "@/server/auth/session"
import { getAuthUser, requireGraphAccess } from "@/server/auth/session"
import { jsonError } from "@/server/api/http"

export type ApiAuthResult =
  | { user: AuthUser; response?: undefined }
  | { user?: undefined; response: NextResponse }

export async function requireApiUser(): Promise<ApiAuthResult> {
  const user = await getAuthUser()
  if (!user) {
    return { response: jsonError(401, "unauthorized", "Authentication required") }
  }

  return { user }
}

export async function requireApiGraphAccess(graphId: string): Promise<ApiAuthResult> {
  const auth = await requireApiUser()
  if (!auth.user) {
    return auth
  }

  const hasAccess = await requireGraphAccess(graphId, auth.user.id)
  if (!hasAccess) {
    return { response: jsonError(404, "graph_not_found", "Graph not found") }
  }

  return auth
}
