import type { LayoutStage } from "@/lib/graph/layout/pipeline"
import type { Edge, Entity } from "@/types"

type VisibleSubgraphInput = {
  entities: Entity[]
  edges: Edge[]
  focusedNodeId: string | null
  distance: number
}

type VisibleSubgraph = {
  entities: Entity[]
  edges: Edge[]
  visibleNodeIds: Set<string>
}

function normalizeRelationshipType(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_")
}

export function computeVisibleSubgraph(input: VisibleSubgraphInput): VisibleSubgraph {
  const entitiesById = new Map(input.entities.map((entity) => [entity.id, entity]))
  const clampedDistance = Number.isFinite(input.distance) ? Math.max(0, Math.floor(input.distance)) : 0
  const focusId = input.focusedNodeId && entitiesById.has(input.focusedNodeId) ? input.focusedNodeId : input.entities[0]?.id

  if (!focusId) {
    return {
      entities: [],
      edges: [],
      visibleNodeIds: new Set<string>()
    }
  }

  const neighborIdsByNodeId = new Map<string, Set<string>>()
  for (const edge of input.edges) {
    if (!entitiesById.has(edge.from_entity_id) || !entitiesById.has(edge.to_entity_id)) {
      continue
    }
    if (!neighborIdsByNodeId.has(edge.from_entity_id)) {
      neighborIdsByNodeId.set(edge.from_entity_id, new Set<string>())
    }
    if (!neighborIdsByNodeId.has(edge.to_entity_id)) {
      neighborIdsByNodeId.set(edge.to_entity_id, new Set<string>())
    }
    neighborIdsByNodeId.get(edge.from_entity_id)?.add(edge.to_entity_id)
    neighborIdsByNodeId.get(edge.to_entity_id)?.add(edge.from_entity_id)
  }

  const visibleNodeIds = new Set<string>()
  const visited = new Set<string>()
  const queue: Array<{ id: string; hops: number }> = []

  const neighborsOf = (id: string): Set<string> => neighborIdsByNodeId.get(id) ?? new Set<string>()

  visited.add(focusId)
  visibleNodeIds.add(focusId)
  queue.push({ id: focusId, hops: 0 })

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }
    if (current.hops >= clampedDistance) {
      continue
    }
    const neighborIds = neighborsOf(current.id)
    for (const neighborId of neighborIds) {
      if (visited.has(neighborId)) {
        continue
      }
      visited.add(neighborId)
      visibleNodeIds.add(neighborId)
      queue.push({ id: neighborId, hops: current.hops + 1 })
    }
  }

  // Romantic partners are force-included for any included node.
  let changed = true
  while (changed) {
    changed = false
    for (const edge of input.edges) {
      if (normalizeRelationshipType(edge.relationship_type) !== "romantic") {
        continue
      }
      const fromIncluded = visibleNodeIds.has(edge.from_entity_id)
      const toIncluded = visibleNodeIds.has(edge.to_entity_id)
      if (!fromIncluded && !toIncluded) {
        continue
      }
      if (!fromIncluded && entitiesById.has(edge.from_entity_id)) {
        visibleNodeIds.add(edge.from_entity_id)
        changed = true
      }
      if (!toIncluded && entitiesById.has(edge.to_entity_id)) {
        visibleNodeIds.add(edge.to_entity_id)
        changed = true
      }
    }
  }

  const entities = input.entities.filter((entity) => visibleNodeIds.has(entity.id))
  const edges = input.edges.filter(
    (edge) => visibleNodeIds.has(edge.from_entity_id) && visibleNodeIds.has(edge.to_entity_id)
  )

  return {
    entities,
    edges,
    visibleNodeIds
  }
}

export const filterGraph: LayoutStage = (ctx) => {
  const {
    entities,
    edges,
    focusNodeId,
    distance
  } = ctx

  if (!focusNodeId || distance == null) {
    return ctx
  }

  const { entities: filteredEntities, edges: filteredEdges } = computeVisibleSubgraph({
    entities,
    edges,
    focusedNodeId: focusNodeId,
    distance
  })

  return {
    ...ctx,
    entities: filteredEntities,
    edges: filteredEdges
  }
}
