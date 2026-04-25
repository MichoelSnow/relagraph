import type { LayoutStage } from "@/lib/graph/layout/pipeline"
import type { FamilyTreeConstraints } from "@/lib/graph/layout/steps/applyConstraints"
import type { FamilyTreeStructure } from "@/lib/graph/layout/steps/buildStructure"
import type { Edge, Entity } from "@/types"

type OrderedFamilyData = {
  dependentsByParentId: Map<string, string[]>
  parentByDependentId: Map<string, string>
  orderRankById: Map<string, number>
  visualDependentsByParentId: Map<string, string[]>
  primaryFamilyId: string | null
  primarySiblingSet: Set<string>
  rootIds: string[]
  familyIds: string[]
  romanticComponentMemberIdsByRootId: Map<string, string[]>
  orderedParentIdsByFamilyId: Map<string, string[]>
}

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

function ownerSetSignature(ownerIds: Iterable<string>): string {
  return [...ownerIds].sort().join("|")
}

function resolvePrimaryFamilyId(
  focusNodeId: string | null | undefined,
  familyParentIdsByFamilyId: Map<string, Set<string>>,
  parentByDependentId: Map<string, string>
): string | null {
  if (!focusNodeId) {
    return null
  }
  if (familyParentIdsByFamilyId.has(focusNodeId)) {
    return focusNodeId
  }
  const dependentParentId = parentByDependentId.get(focusNodeId)
  if (dependentParentId && familyParentIdsByFamilyId.has(dependentParentId)) {
    return dependentParentId
  }

  for (const [familyId, parentIds] of familyParentIdsByFamilyId) {
    if (parentIds.has(focusNodeId)) {
      return familyId
    }
  }

  return null
}

function buildPrimaryFamilyVisualOrder(
  parentId: string | null,
  dependentsByParentId: Map<string, string[]>,
  partnerIdsByEntityId: Map<string, Set<string>>,
  entitiesById: Map<string, Entity>,
  compareIds: (leftId: string, rightId: string) => number
): string[] | null {
  if (!parentId) {
    return null
  }
  const baseDependents = dependentsByParentId.get(parentId) ?? []
  if (baseDependents.length === 0) {
    return null
  }
  const primarySet = new Set(baseDependents)
  const visualOrder = [...baseDependents]

  const insertAdjacent = (anchorId: string, partnerId: string) => {
    const anchorIndex = visualOrder.indexOf(anchorId)
    if (anchorIndex === -1) {
      return
    }
    const existingIndex = visualOrder.indexOf(partnerId)
    if (existingIndex !== -1) {
      if (Math.abs(existingIndex - anchorIndex) <= 1) {
        return
      }
      visualOrder.splice(existingIndex, 1)
      const updatedAnchorIndex = visualOrder.indexOf(anchorId)
      visualOrder.splice(updatedAnchorIndex + 1, 0, partnerId)
      return
    }
    visualOrder.splice(anchorIndex + 1, 0, partnerId)
  }

  for (const dependentId of baseDependents) {
    const partners = [...(partnerIdsByEntityId.get(dependentId) ?? new Set<string>())]
      .filter((partnerId) => entitiesById.has(partnerId))
      .sort(compareIds)
    for (const partnerId of partners) {
      if (primarySet.has(partnerId)) {
        continue
      }
      insertAdjacent(dependentId, partnerId)
    }
  }

  return visualOrder
}

function existingAssignOrderLogic(
  entities: Entity[],
  edges: Edge[],
  structure: FamilyTreeStructure | undefined,
  constrained: FamilyTreeConstraints | undefined,
  previousOrder: Record<string, string[]> | undefined,
  focusNodeId: string | null | undefined
): OrderedFamilyData | undefined {
  if (!structure) {
    return undefined
  }

  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]))
  const birthTimestampById = new Map(
    entities.map((entity) => [entity.id, toTimestamp(readBirthDateLikeValue(entity))])
  )
  const compareIds = (leftId: string, rightId: string) =>
    compareEntityIdsByStableOrder(leftId, rightId, entitiesById, birthTimestampById)

  const dependentsByParentId = new Map(
    [...structure.dependentsByParentId.entries()].map(([parentId, dependentIds]) => [parentId, [...dependentIds]])
  )
  const parentByDependentId = new Map(structure.parentByDependentId)

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

  const familyIdByParentSetSignature = new Map<string, string>()
  for (const [familyId, parentIds] of structure.familyParentIdsByFamilyId) {
    const signature = ownerSetSignature(parentIds)
    if (!familyIdByParentSetSignature.has(signature)) {
      familyIdByParentSetSignature.set(signature, familyId)
    }
  }

  for (const [dependentId, ownerIds] of structure.petOwnerIdsByDependentId) {
    const signature = ownerSetSignature(ownerIds)
    const familyId = familyIdByParentSetSignature.get(signature)
    if (familyId) {
      addDependent(familyId, dependentId)
      continue
    }
    if (ownerIds.size === 1) {
      const ownerId = [...ownerIds][0]
      addDependent(ownerId, dependentId)
      continue
    }
    const sortedOwnerIds = [...ownerIds].sort(compareIds)
    const primaryOwnerId = sortedOwnerIds[0]
    if (primaryOwnerId) {
      addDependent(primaryOwnerId, dependentId)
    }
  }

  for (const [parentId, dependentIds] of dependentsByParentId) {
    const previousOrderForParent = previousOrder?.[parentId] ?? []
    const previousIndexById = new Map(previousOrderForParent.map((id, index) => [id, index]))
    const sortedDependentIds = [...dependentIds].sort((a, b) => {
      const aBirth = birthTimestampById.get(a) ?? null
      const bBirth = birthTimestampById.get(b) ?? null
      if (aBirth !== null && bBirth !== null && aBirth !== bBirth) {
        return aBirth - bBirth
      }
      if (aBirth !== null && bBirth === null) {
        return -1
      }
      if (aBirth === null && bBirth !== null) {
        return 1
      }
      const aLabel = entitiesById.get(a)?.display_name.trim() ?? a
      const bLabel = entitiesById.get(b)?.display_name.trim() ?? b
      const labelCompare = aLabel.localeCompare(bLabel, "en")
      if (labelCompare !== 0) {
        return labelCompare
      }
      const previousA = previousIndexById.get(a)
      const previousB = previousIndexById.get(b)
      if (previousA !== undefined && previousB !== undefined && previousA !== previousB) {
        return previousA - previousB
      }
      return a.localeCompare(b, "en")
    })
    dependentsByParentId.set(parentId, sortedDependentIds)
  }

  const primaryFamilyId = resolvePrimaryFamilyId(
    focusNodeId ?? null,
    structure.familyParentIdsByFamilyId,
    parentByDependentId
  )
  const visualDependentsByParentId = new Map(dependentsByParentId)
  for (const parentId of dependentsByParentId.keys()) {
    const visualOrder = buildPrimaryFamilyVisualOrder(
      parentId,
      dependentsByParentId,
      structure.romanticPartnerIdsByEntityId,
      entitiesById,
      compareIds
    )
    if (visualOrder) {
      visualDependentsByParentId.set(parentId, visualOrder)
    }
  }
  const primarySiblingSet = new Set<string>(dependentsByParentId.get(primaryFamilyId ?? "") ?? [])

  const levels = constrained?.levels ?? new Map<string, number>()
  const orderRankById = new Map<string, number>()
  const idsByLevel = new Map<number, string[]>()
  const romanticMemberIds = new Set<string>()
  for (const romanticComponent of structure.romanticComponents.values()) {
    for (const memberId of romanticComponent) {
      romanticMemberIds.add(memberId)
    }
  }
  for (const entity of entities) {
    const level = levels.get(entity.id) ?? 0
    const ids = idsByLevel.get(level) ?? []
    ids.push(entity.id)
    idsByLevel.set(level, ids)
  }
  for (const ids of idsByLevel.values()) {
    const sortedIds = [...ids].sort((a, b) => {
      const aPriority = romanticMemberIds.has(a) ? 0 : 1
      const bPriority = romanticMemberIds.has(b) ? 0 : 1
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      const aComponentRootId = structure.romanticComponentRootByMemberId.get(a)
      const bComponentRootId = structure.romanticComponentRootByMemberId.get(b)
      if (aComponentRootId && bComponentRootId && aComponentRootId !== bComponentRootId) {
        return compareIds(aComponentRootId, bComponentRootId)
      }
      if (aComponentRootId && !bComponentRootId) {
        return -1
      }
      if (!aComponentRootId && bComponentRootId) {
        return 1
      }
      return compareIds(a, b)
    })
    for (let index = 0; index < sortedIds.length; index += 1) {
      orderRankById.set(sortedIds[index], index)
    }
  }

  const rootIds = entities
    .map((entity) => entity.id)
    .filter((entityId) => !parentByDependentId.has(entityId))
    .sort((leftId, rightId) => {
      const leftLevel = levels.get(leftId) ?? 0
      const rightLevel = levels.get(rightId) ?? 0
      if (leftLevel !== rightLevel) {
        return leftLevel - rightLevel
      }
      const leftOrder = orderRankById.get(leftId) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = orderRankById.get(rightId) ?? Number.MAX_SAFE_INTEGER
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }
      return compareIds(leftId, rightId)
    })

  const familyIds = [...structure.familyParentIdsByFamilyId.keys()].sort((leftId, rightId) => {
    const levelCompare = (levels.get(leftId) ?? 0) - (levels.get(rightId) ?? 0)
    if (levelCompare !== 0) {
      return levelCompare
    }
    return compareIds(leftId, rightId)
  })

  const romanticComponentMemberIdsByRootId = new Map<string, string[]>()
  for (const [rootId, component] of structure.romanticComponents) {
    romanticComponentMemberIdsByRootId.set(rootId, [...component].sort(compareIds))
  }

  const orderedParentIdsByFamilyId = new Map<string, string[]>()
  for (const [familyId, parentIds] of structure.familyParentIdsByFamilyId) {
    orderedParentIdsByFamilyId.set(
      familyId,
      [...parentIds]
        .filter((parentId) => entitiesById.has(parentId))
        .sort(compareIds)
    )
  }

  return {
    dependentsByParentId,
    parentByDependentId,
    orderRankById,
    visualDependentsByParentId,
    primaryFamilyId,
    primarySiblingSet,
    rootIds,
    familyIds,
    romanticComponentMemberIdsByRootId,
    orderedParentIdsByFamilyId
  }
}

export const assignOrder: LayoutStage = (ctx) => {
  const { entities, edges, structure, constrained, previousOrder, focusNodeId } = ctx

  const ordered = existingAssignOrderLogic(
    entities,
    edges,
    structure as FamilyTreeStructure | undefined,
    constrained as FamilyTreeConstraints | undefined,
    previousOrder,
    focusNodeId
  )

  return {
    ...ctx,
    ordered
  }
}
