import { NextResponse } from "next/server"

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details
      }
    },
    { status }
  )
}

export function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? ""
  return contentType.toLowerCase().includes("application/json")
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}

export function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}
