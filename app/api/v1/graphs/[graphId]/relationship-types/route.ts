import { asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { relationship, relationshipType } from "@/db/schema"
import { requireApiGraphAccess } from "@/server/api/auth"

type RouteContext = {
  params: Promise<{ graphId: string }>
}

export async function GET(_: Request, context: RouteContext): Promise<NextResponse> {
  const { graphId } = await context.params
  const auth = await requireApiGraphAccess(graphId)
  if (!auth.user) {
    return auth.response
  }

  const db = getDb()
  const [usedTypes, allTypes] = await Promise.all([
    db
      .selectDistinct({ code: relationshipType.code })
      .from(relationship)
      .innerJoin(relationshipType, eq(relationship.relationshipTypeId, relationshipType.id))
      .where(eq(relationship.graphId, graphId)),
    db
    .select({
      code: relationshipType.code,
      display_name: relationshipType.displayName,
      category: relationshipType.category
    })
    .from(relationshipType)
    .orderBy(asc(relationshipType.displayName))
  ])

  const used = new Set(usedTypes.map((row) => row.code))
  const rows = allTypes.map((row) => ({
    ...row,
    used: used.has(row.code)
  }))

  return NextResponse.json({ relationship_types: rows })
}
