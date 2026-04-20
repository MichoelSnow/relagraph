import { createHash, randomBytes } from "node:crypto"
import { randomUUID } from "node:crypto"

import { and, eq, gt } from "drizzle-orm"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { appUser, userGraph, userSession } from "@/db/schema"

export const SESSION_COOKIE_NAME = "relagraph_session"
const SESSION_TTL_DAYS = 30

export type AuthUser = {
  id: string
  email: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function createUserSession(userId: string): Promise<{ token: string; expiresAt: string }> {
  const db = getDb()
  const token = randomBytes(32).toString("base64url")
  const tokenHash = hashSessionToken(token)
  const expiresAt = addDays(nowIso(), SESSION_TTL_DAYS)

  await db.insert(userSession).values({
    id: randomUUID(),
    userId,
    tokenHash,
    expiresAt
  })

  return { token, expiresAt }
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  })
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    return null
  }

  const db = getDb()
  const tokenHash = hashSessionToken(token)
  const now = nowIso()

  const rows = await db
    .select({
      id: appUser.id,
      email: appUser.email
    })
    .from(userSession)
    .innerJoin(appUser, eq(userSession.userId, appUser.id))
    .where(and(eq(userSession.tokenHash, tokenHash), gt(userSession.expiresAt, now)))
    .limit(1)

  return rows[0] ?? null
}

export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) {
    redirect("/login")
  }

  return user
}

export async function requireGraphAccess(graphId: string, userId: string): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ id: userGraph.id })
    .from(userGraph)
    .where(and(eq(userGraph.id, graphId), eq(userGraph.ownerUserId, userId)))
    .limit(1)

  return rows.length > 0
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const db = getDb()
  await db.delete(userSession).where(eq(userSession.tokenHash, hashSessionToken(token)))
}
