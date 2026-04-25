import {
  inferDependentEdgeDirection,
  isFamilyChildRelationshipType,
  isFamilyParentRelationshipType,
  isParentChildRelationshipType,
  isRomanticRelationshipType
} from "@/lib/graph/semantics/relationshipSemantics"
import type { Edge, Entity } from "@/types"

import type { LayoutStage } from "@/lib/graph/layout/pipeline"

export type FamilyAnchor = {
  id: string
  parentIds: string[]
  childIds: string[]
  x?: number
  y?: number
}

export type FamilyTreeStructure = {
  anchors: FamilyAnchor[]
  familyParentIdsByFamilyId: Map<string, Set<string>>
  familyDependentIdsByFamilyId: Map<string, Set<string>>
  romanticNeighborIdsByEntityId: Map<string, Set<string>>
  romanticPartnerIdsByEntityId: Map<string, Set<string>>
  petOwnerIdsByDependentId: Map<string, Set<string>>
  dependentsByParentId: Map<string, string[]>
  parentByDependentId: Map<string, string>
  romanticComponents: Map<string, string[]>
  romanticComponentRootByMemberId: Map<string, string>
}

function findFamilyIdByExactParentSet(
  familyParentIdsByFamilyId: Map<string, Set<string>>,
  targetParentIds: Set<string>
): string | null {
  for (const [familyId, parentIds] of familyParentIdsByFamilyId) {
    if (parentIds.size !== targetParentIds.size) {
      continue
    }
    let equal = true
    for (const parentId of targetParentIds) {
      if (!parentIds.has(parentId)) {
        equal = false
        break
      }
    }
    if (equal) {
      return familyId
    }
  }
  return null
}

function resolvePetOwnerAndDependent(edge: Edge, entitiesById: Map<string, Entity>): { ownerId: string; dependentId: string } | null {
  const roleDirection = inferDependentEdgeDirection(edge)
  if (roleDirection) {
    return { ownerId: roleDirection.sourceId, dependentId: roleDirection.dependentId }
  }

  const fromEntity = entitiesById.get(edge.from_entity_id)
  const toEntity = entitiesById.get(edge.to_entity_id)
  if (fromEntity?.entity_kind !== "animal" && toEntity?.entity_kind === "animal") {
    return { ownerId: edge.from_entity_id, dependentId: edge.to_entity_id }
  }
  if (toEntity?.entity_kind !== "animal" && fromEntity?.entity_kind === "animal") {
    return { ownerId: edge.to_entity_id, dependentId: edge.from_entity_id }
  }
  return null
}

function collectRomanticPartnerIdsByEntityId(edges: Edge[]): Map<string, Set<string>> {
  const partnerIdsByEntityId = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!isRomanticRelationshipType(edge.relationship_type)) {
      continue
    }
    if (!partnerIdsByEntityId.has(edge.from_entity_id)) {
      partnerIdsByEntityId.set(edge.from_entity_id, new Set<string>())
    }
    if (!partnerIdsByEntityId.has(edge.to_entity_id)) {
      partnerIdsByEntityId.set(edge.to_entity_id, new Set<string>())
    }
    partnerIdsByEntityId.get(edge.from_entity_id)?.add(edge.to_entity_id)
    partnerIdsByEntityId.get(edge.to_entity_id)?.add(edge.from_entity_id)
  }
  return partnerIdsByEntityId
}

export function buildFamilyTreeStructure(entities: Entity[], edges: Edge[]): FamilyTreeStructure {
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]))
  const familyParentIdsByFamilyId = new Map<string, Set<string>>()
  const familyDependentIdsByFamilyId = new Map<string, Set<string>>()
  const parentIdsByChildId = new Map<string, Set<string>>()
  const romanticNeighborIdsByEntityId = new Map<string, Set<string>>()
  const romanticPartnerIdsByEntityId = collectRomanticPartnerIdsByEntityId(edges)
  const petOwnerIdsByDependentId = new Map<string, Set<string>>()
  const dependentsByParentId = new Map<string, string[]>()
  const parentByDependentId = new Map<string, string>()

  for (const edge of edges) {
    if (isFamilyParentRelationshipType(edge.relationship_type)) {
      const familyId = edge.to_entity_id
      const parentId = edge.from_entity_id
      if (!entitiesById.has(parentId)) {
        continue
      }
      if (!familyParentIdsByFamilyId.has(familyId)) {
        familyParentIdsByFamilyId.set(familyId, new Set<string>())
      }
      familyParentIdsByFamilyId.get(familyId)?.add(parentId)
      continue
    }

    if (isFamilyChildRelationshipType(edge.relationship_type)) {
      const familyId = edge.from_entity_id
      const childId = edge.to_entity_id
      if (!entitiesById.has(childId)) {
        continue
      }
      if (!familyDependentIdsByFamilyId.has(familyId)) {
        familyDependentIdsByFamilyId.set(familyId, new Set<string>())
      }
      familyDependentIdsByFamilyId.get(familyId)?.add(childId)
      continue
    }

    if (isRomanticRelationshipType(edge.relationship_type)) {
      if (!romanticNeighborIdsByEntityId.has(edge.from_entity_id)) {
        romanticNeighborIdsByEntityId.set(edge.from_entity_id, new Set<string>())
      }
      if (!romanticNeighborIdsByEntityId.has(edge.to_entity_id)) {
        romanticNeighborIdsByEntityId.set(edge.to_entity_id, new Set<string>())
      }
      romanticNeighborIdsByEntityId.get(edge.from_entity_id)?.add(edge.to_entity_id)
      romanticNeighborIdsByEntityId.get(edge.to_entity_id)?.add(edge.from_entity_id)
      continue
    }

    const petOwnerAndDependent = resolvePetOwnerAndDependent(edge, entitiesById)
    if (petOwnerAndDependent) {
      const { ownerId, dependentId } = petOwnerAndDependent
      if (!petOwnerIdsByDependentId.has(dependentId)) {
        petOwnerIdsByDependentId.set(dependentId, new Set<string>())
      }
      petOwnerIdsByDependentId.get(dependentId)?.add(ownerId)
    }

    if (!isParentChildRelationshipType(edge.relationship_type)) {
      continue
    }
    const parentChildDirection = inferDependentEdgeDirection(edge)
    if (!parentChildDirection) {
      continue
    }
    const parentId = parentChildDirection.sourceId
    const childId = parentChildDirection.dependentId
    if (!entitiesById.has(parentId) || !entitiesById.has(childId)) {
      continue
    }
    const parentIds = parentIdsByChildId.get(childId) ?? new Set<string>()
    parentIds.add(parentId)
    parentIdsByChildId.set(childId, parentIds)
  }

  for (const [childId, parentIds] of parentIdsByChildId) {
    if (parentIds.size === 0) {
      continue
    }
    const familyId =
      findFamilyIdByExactParentSet(familyParentIdsByFamilyId, parentIds) ??
      `family:${[...parentIds].join("|")}`
    if (!familyParentIdsByFamilyId.has(familyId)) {
      familyParentIdsByFamilyId.set(familyId, new Set<string>())
    }
    for (const parentId of parentIds) {
      familyParentIdsByFamilyId.get(familyId)?.add(parentId)
    }
    if (!familyDependentIdsByFamilyId.has(familyId)) {
      familyDependentIdsByFamilyId.set(familyId, new Set<string>())
    }
    familyDependentIdsByFamilyId.get(familyId)?.add(childId)
  }

  for (const [dependentId, ownerIds] of petOwnerIdsByDependentId) {
    if (ownerIds.size === 0) {
      continue
    }
    const familyId =
      findFamilyIdByExactParentSet(familyParentIdsByFamilyId, ownerIds) ??
      `family:${[...ownerIds].join("|")}`
    if (!familyParentIdsByFamilyId.has(familyId)) {
      familyParentIdsByFamilyId.set(familyId, new Set<string>())
    }
    for (const ownerId of ownerIds) {
      familyParentIdsByFamilyId.get(familyId)?.add(ownerId)
    }
    if (!familyDependentIdsByFamilyId.has(familyId)) {
      familyDependentIdsByFamilyId.set(familyId, new Set<string>())
    }
    familyDependentIdsByFamilyId.get(familyId)?.add(dependentId)
  }

  const anchors: FamilyAnchor[] = []
  for (const [anchorId, parentIds] of familyParentIdsByFamilyId) {
    const childIds = [...(familyDependentIdsByFamilyId.get(anchorId) ?? new Set<string>())]
      .filter((childId) => entitiesById.has(childId))
    const validParentIds = [...parentIds]
      .filter((parentId) => entitiesById.has(parentId))
    if (validParentIds.length === 0 || childIds.length === 0) {
      continue
    }
    anchors.push({
      id: anchorId,
      parentIds: validParentIds,
      childIds
    })
  }

  const addDependent = (parentId: string, dependentId: string) => {
    if (!entitiesById.has(dependentId) || parentId === dependentId) {
      return
    }
    const existingParentId = parentByDependentId.get(dependentId)
    if (existingParentId && existingParentId !== parentId) {
      return
    }
    parentByDependentId.set(dependentId, parentId)
    const ids = dependentsByParentId.get(parentId) ?? []
    if (!ids.includes(dependentId)) {
      ids.push(dependentId)
      dependentsByParentId.set(parentId, ids)
    }
  }

  for (const [familyId, dependentIds] of familyDependentIdsByFamilyId) {
    for (const dependentId of dependentIds) {
      addDependent(familyId, dependentId)
    }
  }

  const romanticComponents = new Map<string, string[]>()
  const romanticComponentRootByMemberId = new Map<string, string>()
  const visitedRomanticIds = new Set<string>()
  for (const entity of entities) {
    if (visitedRomanticIds.has(entity.id)) {
      continue
    }
    const neighbors = romanticNeighborIdsByEntityId.get(entity.id)
    if (!neighbors || neighbors.size === 0) {
      continue
    }
    const queue = [entity.id]
    const component: string[] = []
    visitedRomanticIds.add(entity.id)
    while (queue.length > 0) {
      const currentId = queue.shift()
      if (!currentId) {
        continue
      }
      component.push(currentId)
      const nextNeighbors = romanticNeighborIdsByEntityId.get(currentId)
      if (!nextNeighbors) {
        continue
      }
      for (const neighborId of nextNeighbors) {
        if (!visitedRomanticIds.has(neighborId)) {
          visitedRomanticIds.add(neighborId)
          queue.push(neighborId)
        }
      }
    }
    const rootId = component[0]
    romanticComponents.set(rootId, component)
    for (const memberId of component) {
      romanticComponentRootByMemberId.set(memberId, rootId)
    }
  }

  return {
    anchors,
    familyParentIdsByFamilyId,
    familyDependentIdsByFamilyId,
    romanticNeighborIdsByEntityId,
    romanticPartnerIdsByEntityId,
    petOwnerIdsByDependentId,
    dependentsByParentId,
    parentByDependentId,
    romanticComponents,
    romanticComponentRootByMemberId
  }
}

export const buildStructure: LayoutStage = (ctx) => {
  const structure = buildFamilyTreeStructure(ctx.entities, ctx.edges)
  return {
    ...ctx,
    structure
  }
}
