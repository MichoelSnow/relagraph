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

  const isFamilyNodeId = (id: string): boolean => entitiesById.get(id)?.entity_kind === "family"
  const visibleNodeIds = new Set<string>()
  const visited = new Set<string>()
  const queue: Array<{ id: string; hops: number }> = []

  const neighborsOf = (id: string): Set<string> => {
    const directNeighbors = neighborIdsByNodeId.get(id) ?? new Set<string>()
    const resolved = new Set<string>()
    if (isFamilyNodeId(id)) {
      for (const neighborId of directNeighbors) {
        if (!isFamilyNodeId(neighborId)) {
          resolved.add(neighborId)
        }
      }
      return resolved
    }

    for (const neighborId of directNeighbors) {
      if (!isFamilyNodeId(neighborId)) {
        resolved.add(neighborId)
        continue
      }
      const familyMembers = neighborIdsByNodeId.get(neighborId) ?? new Set<string>()
      for (const memberId of familyMembers) {
        if (memberId !== id && !isFamilyNodeId(memberId)) {
          resolved.add(memberId)
        }
      }
    }
    return resolved
  }

  if (isFamilyNodeId(focusId)) {
    visibleNodeIds.add(focusId)
    const adjacent = neighborsOf(focusId)
    for (const adjacentId of adjacent) {
      visited.add(adjacentId)
      visibleNodeIds.add(adjacentId)
      queue.push({ id: adjacentId, hops: 0 })
    }
  } else {
    visited.add(focusId)
    visibleNodeIds.add(focusId)
    queue.push({ id: focusId, hops: 0 })
  }

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

  // Family nodes are force-included when any linked parent/child is included.
  for (const edge of input.edges) {
    const relationshipType = normalizeRelationshipType(edge.relationship_type)
    if (relationshipType !== "family_parent" && relationshipType !== "family_child") {
      continue
    }
    const fromEntity = entitiesById.get(edge.from_entity_id)
    const toEntity = entitiesById.get(edge.to_entity_id)
    if (!fromEntity || !toEntity) {
      continue
    }

    if (fromEntity.entity_kind === "family" && visibleNodeIds.has(toEntity.id)) {
      visibleNodeIds.add(fromEntity.id)
    } else if (toEntity.entity_kind === "family" && visibleNodeIds.has(fromEntity.id)) {
      visibleNodeIds.add(toEntity.id)
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
