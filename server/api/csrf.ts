import type { NextResponse } from "next/server"

import { jsonError } from "@/server/api/http"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function sameOrigin(origin: string, requestUrl: string): boolean {
  let parsedOrigin: URL
  let parsedRequestUrl: URL

  try {
    parsedOrigin = new URL(origin)
    parsedRequestUrl = new URL(requestUrl)
  } catch {
    return false
  }

  return parsedOrigin.protocol === parsedRequestUrl.protocol && parsedOrigin.host === parsedRequestUrl.host
}

export function requireCsrfProtection(request: Request): NextResponse | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return null
  }

  const origin = request.headers.get("origin")
  if (!origin) {
    return jsonError(403, "csrf_origin_missing", "Origin header is required for state-changing requests")
  }

  if (!sameOrigin(origin, request.url)) {
    return jsonError(403, "csrf_origin_mismatch", "Origin does not match request host")
  }

  return null
}
