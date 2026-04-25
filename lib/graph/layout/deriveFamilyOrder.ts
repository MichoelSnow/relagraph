import { inferDependentEdgeDirection, isParentChildRelationshipType } from "@/lib/graph/semantics/relationshipSemantics"
import type { LayoutInput, LayoutOutput, PreviousOrder } from "@/lib/graph/layout/types"
import type { Edge, Entity } from "@/types"

function resolvePetOwnerAndDependent(edge: Edge, entitiesById: Map<string, Entity>): { ownerId: string; dependentId: string } | null {
  const roleDirection = inferDependentEdgeDirection(edge)
  if (roleDirection && edge.relationship_type === "animal") {
    return { ownerId: roleDirection.sourceId, dependentId: roleDirection.dependentId }
  }

  const fromEntity = entitiesById.get(edge.from_entity_id)
  const toEntity = entitiesById.get(edge.to_entity_id)
  if (edge.relationship_type === "animal") {
    if (fromEntity?.entity_kind !== "animal" && toEntity?.entity_kind === "animal") {
      return { ownerId: edge.from_entity_id, dependentId: edge.to_entity_id }
    }
    if (toEntity?.entity_kind !== "animal" && fromEntity?.entity_kind === "animal") {
      return { ownerId: edge.to_entity_id, dependentId: edge.from_entity_id }
    }
  }

  return null
}

function resolveParentAndDependent(edge: Edge, entitiesById: Map<string, Entity>): { parentId: string; dependentId: string } | null {
  if (edge.relationship_type === "family_child") {
    return { parentId: edge.from_entity_id, dependentId: edge.to_entity_id }
  }
  if (isParentChildRelationshipType(edge.relationship_type)) {
    const roleDirection = inferDependentEdgeDirection(edge)
    if (roleDirection) {
      return { parentId: roleDirection.sourceId, dependentId: roleDirection.dependentId }
    }
  }
  const ownerAndDependent = resolvePetOwnerAndDependent(edge, entitiesById)
  if (ownerAndDependent) {
    return { parentId: ownerAndDependent.ownerId, dependentId: ownerAndDependent.dependentId }
  }
  return null
}

export function deriveFamilyOrderFromLayout(
  input: LayoutInput,
  output: LayoutOutput
): PreviousOrder {
  const entitiesById = new Map(input.entities.map((entity) => [entity.id, entity]))
  const xById = new Map(output.nodes.map((node) => [node.id, node.x]))
  const dependentsByParentId = new Map<string, Set<string>>()

  for (const edge of input.edges) {
    const relation = resolveParentAndDependent(edge, entitiesById)
    if (!relation) {
      continue
    }
    if (!dependentsByParentId.has(relation.parentId)) {
      dependentsByParentId.set(relation.parentId, new Set<string>())
    }
    dependentsByParentId.get(relation.parentId)?.add(relation.dependentId)
  }

  const order: PreviousOrder = {}
  for (const [parentId, dependentIds] of dependentsByParentId) {
    const ordered = [...dependentIds].sort((leftId, rightId) => {
      const leftX = xById.get(leftId)
      const rightX = xById.get(rightId)
      if (leftX !== undefined && rightX !== undefined && leftX !== rightX) {
        return leftX - rightX
      }
      return leftId.localeCompare(rightId, "en")
    })
    order[parentId] = ordered
  }

  return order
}
