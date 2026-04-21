import type { NextResponse } from "next/server"

import { jsonError } from "@/server/api/http"

type RateLimitOptions = {
  scope: string
  limit: number
  windowMs: number
  subject: string
}

type Bucket = {
  count: number
  resetAtMs: number
}

const buckets = new Map<string, Bucket>()
let callsSinceSweep = 0
const SWEEP_INTERVAL = 200

function getClientIpFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim()
    if (first) {
      return first
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

function getBucketKey(options: RateLimitOptions): string {
  return `${options.scope}:${options.subject}`
}

function sweepExpiredBuckets(nowMs: number): void {
  callsSinceSweep += 1
  if (callsSinceSweep < SWEEP_INTERVAL) {
    return
  }

  callsSinceSweep = 0
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAtMs <= nowMs) {
      buckets.delete(key)
    }
  }
}

export function enforceRateLimit(options: RateLimitOptions): NextResponse | null {
  const nowMs = Date.now()
  sweepExpiredBuckets(nowMs)

  const bucketKey = getBucketKey(options)
  const existing = buckets.get(bucketKey)

  if (!existing || existing.resetAtMs <= nowMs) {
    buckets.set(bucketKey, { count: 1, resetAtMs: nowMs + options.windowMs })
    return null
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000))
    const response = jsonError(429, "rate_limited", "Too many requests, please retry shortly")
    response.headers.set("Retry-After", String(retryAfterSeconds))
    return response
  }

  existing.count += 1
  buckets.set(bucketKey, existing)
  return null
}

export function enforceRateLimitByRequest(
  request: Request,
  config: Omit<RateLimitOptions, "subject">
): NextResponse | null {
  return enforceRateLimit({
    ...config,
    subject: getClientIpFromRequest(request)
  })
}

export function extractIpFromHeaders(headers: Record<string, string | string[] | undefined>): string {
  const forwardedFor = headers["x-forwarded-for"]
  if (typeof forwardedFor === "string") {
    const first = forwardedFor.split(",")[0]?.trim()
    if (first) {
      return first
    }
  }
  if (Array.isArray(forwardedFor)) {
    const firstItem = forwardedFor[0]?.split(",")[0]?.trim()
    if (firstItem) {
      return firstItem
    }
  }

  const realIp = headers["x-real-ip"]
  if (typeof realIp === "string" && realIp.trim().length > 0) {
    return realIp.trim()
  }
  if (Array.isArray(realIp) && realIp[0]?.trim()) {
    return realIp[0].trim()
  }

  return "unknown"
}
