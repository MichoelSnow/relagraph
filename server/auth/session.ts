import { and, eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { getDb } from "@/db/client"
import { appUser, userGraph } from "@/db/schema"
import { authOptions } from "@/server/auth/options"

export type AuthUser = {
  id: string
  username: string
}

export async function getAuthUser(): Promise<AuthUser | null> {
  let session: { user?: { id?: string | null; email?: string | null } } | null
  try {
    session = (await getServerSession(authOptions)) as { user?: { id?: string | null; email?: string | null } } | null
  } catch {
    return null
  }

  const sessionUserId = session?.user?.id?.trim()
  const sessionUsername = session?.user?.email?.trim().toLowerCase()

  const db = getDb()

  if (sessionUserId) {
    const usersById = await db
      .select({ id: appUser.id, username: appUser.email })
      .from(appUser)
      .where(eq(appUser.id, sessionUserId))
      .limit(1)

    if (usersById[0]) {
      return usersById[0]
    }
  }

  if (!sessionUsername) {
    return null
  }

  const usersByUsername = await db
    .select({ id: appUser.id, username: appUser.email })
    .from(appUser)
    .where(eq(appUser.email, sessionUsername))
    .limit(1)

  return usersByUsername[0] ?? null
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
