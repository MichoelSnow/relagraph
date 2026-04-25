import type { Edge, Entity } from "@/types"

import { runPipeline, type LayoutPipeline, type LayoutStage } from "@/lib/graph/layout/pipeline"
import { applyConstraints } from "@/lib/graph/layout/steps/applyConstraints"
import { buildStructure } from "@/lib/graph/layout/steps/buildStructure"
import { filterGraph } from "@/lib/graph/layout/steps/filterGraph"

function readBirthDateLikeValue(entity: Entity): string | null {
  const raw = entity as unknown as Record<string, unknown>
  const directBirthDate = raw.birth_date
  if (typeof directBirthDate === "string" && directBirthDate.trim().length > 0) {
    return directBirthDate
  }
  const directBirthDateCamel = raw.birthDate
  if (typeof directBirthDateCamel === "string" && directBirthDateCamel.trim().length > 0) {
    return directBirthDateCamel
  }

  const profile = raw.profile as Record<string, unknown> | undefined
  if (profile && typeof profile === "object") {
    const profileBirthDate = profile.birth_date
    if (typeof profileBirthDate === "string" && profileBirthDate.trim().length > 0) {
      return profileBirthDate
    }
    const profileBirthDateCamel = profile.birthDate
    if (typeof profileBirthDateCamel === "string" && profileBirthDateCamel.trim().length > 0) {
      return profileBirthDateCamel
    }
  }

  return null
}

function toTimestamp(value: string | null): number | null {
  if (!value) {
    return null
  }
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function compareEntityIdsByStableOrder(
  leftId: string,
  rightId: string,
  entitiesById: Map<string, Entity>,
  birthTimestampById: Map<string, number | null>
): number {
  if (leftId === rightId) {
    return 0
  }

  const leftBirth = birthTimestampById.get(leftId) ?? null
  const rightBirth = birthTimestampById.get(rightId) ?? null
  if (leftBirth !== null && rightBirth !== null && leftBirth !== rightBirth) {
    return leftBirth - rightBirth
  }
  if (leftBirth !== null && rightBirth === null) {
    return -1
  }
  if (leftBirth === null && rightBirth !== null) {
    return 1
  }

  const leftLabel = entitiesById.get(leftId)?.display_name.trim() ?? leftId
  const rightLabel = entitiesById.get(rightId)?.display_name.trim() ?? rightId
  const labelCompare = leftLabel.localeCompare(rightLabel, "en")
  if (labelCompare !== 0) {
    return labelCompare
  }

  return leftId.localeCompare(rightId, "en")
}

function computeNodeLevels(entities: Entity[], edges: Edge[]): Map<string, number> {
  const levels = new Map<string, number>(entities.map((entity) => [entity.id, 0]))

  for (let iteration = 0; iteration < entities.length * 2; iteration += 1) {
    let changed = false

    for (const edge of edges) {
      const fromLevel = levels.get(edge.from_entity_id) ?? 0
      const toLevel = levels.get(edge.to_entity_id) ?? 0
      if (toLevel < fromLevel + 1) {
        levels.set(edge.to_entity_id, fromLevel + 1)
        changed = true
      }
    }

    if (!changed) {
      break
    }
  }

  return levels
}

const applyExistingGraphLayout: LayoutStage = (ctx) => {
  const entities = ctx.entities
  const edges = ctx.edges
  const horizontalSpacing = ctx.layoutConfig?.horizontalSpacing ?? 100
  const verticalSpacing = ctx.layoutConfig?.verticalSpacing ?? 180

  const levels = computeNodeLevels(entities, edges)
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]))
  const birthTimestampById = new Map(
    entities.map((entity) => [entity.id, toTimestamp(readBirthDateLikeValue(entity))])
  )
  const idsByLevel = new Map<number, string[]>()

  for (const entity of entities) {
    const level = levels.get(entity.id) ?? 0
    const ids = idsByLevel.get(level) ?? []
    ids.push(entity.id)
    idsByLevel.set(level, ids)
  }

  const nodes: { id: string; x: number; y: number }[] = []
  const levelOrder = [...idsByLevel.keys()].sort((a, b) => a - b)
  for (const level of levelOrder) {
    const ids = idsByLevel.get(level) ?? []
    ids.sort((a, b) => compareEntityIdsByStableOrder(a, b, entitiesById, birthTimestampById))

    const centerOffset = (ids.length - 1) / 2
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index]
      nodes.push({
        id,
        x: (index - centerOffset) * horizontalSpacing,
        y: level * verticalSpacing
      })
    }
  }

  return {
    ...ctx,
    result: {
      nodes,
      edges: edges.map((edge) => ({ id: edge.id }))
    }
  }
}

export const graphLayout: LayoutPipeline = (ctx) =>
  runPipeline(ctx, [filterGraph, buildStructure, applyConstraints, applyExistingGraphLayout], (current) =>
    current.result ?? { nodes: [], edges: [] }
  )
