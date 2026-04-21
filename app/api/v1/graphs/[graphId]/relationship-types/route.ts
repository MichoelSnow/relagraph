import { asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getDb } from "@/db/client"
import { relationship, relationshipType } from "@/db/schema"
import { requireApiGraphAccess } from "@/server/api/auth"

type RouteContext = {
  params: Promise<{ graphId: string }>
}

const RELATIONSHIP_ROLE_PRESETS: Record<
  string,
  { display_name: string; source_roles: string[]; target_roles: string[] }
> = {
  parent_child: {
    display_name: "Parent-Child",
    source_roles: ["parent", "child"],
    target_roles: ["parent", "child"]
  },
  romantic: {
    display_name: "Romantic",
    source_roles: ["spouse", "partner", "husband", "wife", "boyfriend", "girlfriend", "it's complicated"],
    target_roles: ["spouse", "partner", "husband", "wife", "boyfriend", "girlfriend", "it's complicated"]
  },
  animal: {
    display_name: "Animal",
    source_roles: ["owner", "parent", "pet", "friend", "animal"],
    target_roles: ["owner", "parent", "pet", "friend", "animal"]
  },
  sibling: {
    display_name: "Sibling",
    source_roles: ["sibling", "step-sibling", "half-sibling", "adopted sibling", "foster sibling"],
    target_roles: ["sibling", "step-sibling", "half-sibling", "adopted sibling", "foster sibling"]
  }
}

const RELATIONSHIP_TYPE_ORDER = ["parent_child", "romantic", "animal", "sibling"] as const

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
  const rowsFromDbByCode = new Map(
    allTypes.map((row) => [row.code.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_"), row])
  )
  const rows = RELATIONSHIP_TYPE_ORDER.map((presetCode) => {
    const dbRow = rowsFromDbByCode.get(presetCode)
    const preset = RELATIONSHIP_ROLE_PRESETS[presetCode]
    return {
      code: dbRow?.code ?? presetCode,
      display_name: preset.display_name,
      category: dbRow?.category ?? null,
      source_roles: preset.source_roles,
      target_roles: preset.target_roles,
      used: used.has(dbRow?.code ?? presetCode)
    }
  })

  return NextResponse.json({ relationship_types: rows })
}
