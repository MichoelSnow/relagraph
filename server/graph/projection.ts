import { eq } from "drizzle-orm"

import { getDb } from "@/db/client"
import { entity } from "@/db/schema"
import type { Entity, GraphResponse } from "@/types"

type BuildGraphDeltaInput = {
  centerEntityId: string
  alreadyLoadedEntityIds: Set<string>
  allowedEntityKinds: Set<string> | null
}

function toGraphEntity(row: { id: string; entityKind: "person" | "animal" | "place"; canonicalDisplayName: string }): Entity {
  return {
    id: row.id,
    entity_kind: row.entityKind,
    display_name: row.canonicalDisplayName
  }
}

export async function buildGraphDeltaFromCenter(input: BuildGraphDeltaInput): Promise<GraphResponse | null> {
  const db = getDb()

  const centerRows = await db
    .select({
      id: entity.id,
      entityKind: entity.entityKind,
      canonicalDisplayName: entity.canonicalDisplayName
    })
    .from(entity)
    .where(eq(entity.id, input.centerEntityId))
    .limit(1)

  const center = centerRows[0]
  if (!center) {
    return null
  }

  const includeCenterByType =
    !input.allowedEntityKinds || input.allowedEntityKinds.has(center.entityKind)
  const includeCenterByDelta = !input.alreadyLoadedEntityIds.has(center.id)

  const entities = includeCenterByType && includeCenterByDelta ? [toGraphEntity(center)] : []

  return {
    entities,
    edges: [],
    meta: {
      truncated: false,
      node_count: entities.length,
      edge_count: 0
    }
  }
}
