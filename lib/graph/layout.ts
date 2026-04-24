import { computeNodeLevels } from "@/lib/graph/layoutLevels"
import type { Edge, Entity } from "@/types"

export type LayoutInput = {
  entities: Entity[]
  edges: Edge[]
}

export type LayoutOutput = {
  nodes: { id: string; x: number; y: number }[]
  // Intentionally `any` for future engine-specific edge geometry payloads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: { id: string; path?: any }[]
}

export type NodePosition = { x: number; y: number }
export type PreviousPositions = Record<string, NodePosition>
export type PreviousOrder = Record<string, string[]>
export type LayoutChangeType = "selection_only" | "local_add" | "local_remove" | "global_change"

export type LayoutConfig = {
  horizontalSpacing: number
  verticalSpacing: number
}

export type ResolvedLayout = {
  requestedMode: LayoutMode
  resolvedMode: LayoutMode
  output: LayoutOutput
  fallbackReason?: "too_many_parents" | "unsupported_structure" | "excessive_crossing" | "layout_error"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LayoutEngine = (input: LayoutInput, config?: any) => LayoutOutput

const VERTICAL_SPACING = 180
const HORIZONTAL_SPACING = 180
const MAX_PARENTS_PER_FAMILY = 4
const MAX_FAMILY_LAYOUT_CROSSINGS = 12

function normalizeRelationshipType(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_")
}

function normalizeRole(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_")
}

function ownerSetSignature(ownerIds: Iterable<string>): string {
  return [...ownerIds].sort().join("|")
}

function resolvePetOwnerAndDependent(edge: Edge, entitiesById: Map<string, Entity>): { ownerId: string; dependentId: string } | null {
  const relationshipType = normalizeRelationshipType(edge.relationship_type)
  const fromRole = normalizeRole(edge.roles.from)
  const toRole = normalizeRole(edge.roles.to)
  const fromEntity = entitiesById.get(edge.from_entity_id)
  const toEntity = entitiesById.get(edge.to_entity_id)

  const fromIsDependentRole = fromRole === "pet" || fromRole === "animal"
  const toIsDependentRole = toRole === "pet" || toRole === "animal"
  const fromIsOwnerRole = fromRole === "owner"
  const toIsOwnerRole = toRole === "owner"

  if (fromIsOwnerRole && toIsDependentRole) {
    return { ownerId: edge.from_entity_id, dependentId: edge.to_entity_id }
  }
  if (toIsOwnerRole && fromIsDependentRole) {
    return { ownerId: edge.to_entity_id, dependentId: edge.from_entity_id }
  }

  if (relationshipType === "animal") {
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
  const relationshipType = normalizeRelationshipType(edge.relationship_type)
  if (relationshipType === "family_child") {
    return { parentId: edge.from_entity_id, dependentId: edge.to_entity_id }
  }
  if (relationshipType === "parent_child") {
    const fromRole = normalizeRole(edge.roles.from)
    const toRole = normalizeRole(edge.roles.to)
    if (fromRole === "parent" && toRole === "child") {
      return { parentId: edge.from_entity_id, dependentId: edge.to_entity_id }
    }
    if (toRole === "parent" && fromRole === "child") {
      return { parentId: edge.to_entity_id, dependentId: edge.from_entity_id }
    }
  }
  const ownerAndDependent = resolvePetOwnerAndDependent(edge, entitiesById)
  if (ownerAndDependent) {
    return { parentId: ownerAndDependent.ownerId, dependentId: ownerAndDependent.dependentId }
  }
  return null
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

function resolveSpacingConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: any
): LayoutConfig {
  const horizontalSpacing =
    typeof config?.horizontalSpacing === "number" && Number.isFinite(config.horizontalSpacing)
      ? config.horizontalSpacing
      : HORIZONTAL_SPACING
  const verticalSpacing =
    typeof config?.verticalSpacing === "number" && Number.isFinite(config.verticalSpacing)
      ? config.verticalSpacing
      : VERTICAL_SPACING

  return {
    horizontalSpacing: horizontalSpacing > 0 ? horizontalSpacing : HORIZONTAL_SPACING,
    verticalSpacing: verticalSpacing > 0 ? verticalSpacing : VERTICAL_SPACING
  }
}

function computeLevelPositions(input: LayoutInput, config?: LayoutConfig): LayoutOutput {
  const { entities, edges } = input
  const { horizontalSpacing, verticalSpacing } = resolveSpacingConfig(config)
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
    nodes,
    edges: edges.map((edge) => ({ id: edge.id }))
  }
}

export const graphLayout: LayoutEngine = (input, config) => computeLevelPositions(input, config)

export const familyTreeLayout: LayoutEngine = (input, config) => {
  const { entities, edges } = input
  const { horizontalSpacing, verticalSpacing } = resolveSpacingConfig(config)
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]))
  const birthTimestampById = new Map(
    entities.map((entity) => [entity.id, toTimestamp(readBirthDateLikeValue(entity))])
  )

  const levels = new Map<string, number>()
  const xById = new Map<string, number>()
  const familyParentIdsByFamilyId = new Map<string, Set<string>>()
  const familyDependentIdsByFamilyId = new Map<string, Set<string>>()
  const romanticNeighborIdsByEntityId = new Map<string, Set<string>>()
  const petOwnerIdsByDependentId = new Map<string, Set<string>>()
  const dependentsByParentId = new Map<string, string[]>()
  const parentByDependentId = new Map<string, string>()
  const orderRankById = new Map<string, number>()

  for (const entity of entities) {
    levels.set(entity.id, 0)
  }

  for (const edge of edges) {
    const relationshipType = normalizeRelationshipType(edge.relationship_type)
    if (relationshipType === "family_parent") {
      const familyId = edge.to_entity_id
      const parentId = edge.from_entity_id
      if (!entitiesById.has(familyId) || !entitiesById.has(parentId)) {
        continue
      }
      if (!familyParentIdsByFamilyId.has(familyId)) {
        familyParentIdsByFamilyId.set(familyId, new Set<string>())
      }
      familyParentIdsByFamilyId.get(familyId)?.add(parentId)
      continue
    }

    if (relationshipType === "family_child") {
      const familyId = edge.from_entity_id
      const childId = edge.to_entity_id
      if (!entitiesById.has(familyId) || !entitiesById.has(childId)) {
        continue
      }
      if (!familyDependentIdsByFamilyId.has(familyId)) {
        familyDependentIdsByFamilyId.set(familyId, new Set<string>())
      }
      familyDependentIdsByFamilyId.get(familyId)?.add(childId)
      continue
    }

    if (relationshipType === "romantic") {
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
  }

  const addDependent = (parentId: string, dependentId: string) => {
    if (!entitiesById.has(parentId) || !entitiesById.has(dependentId) || parentId === dependentId) {
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
    component.sort((a, b) => compareEntityIdsByStableOrder(a, b, entitiesById, birthTimestampById))
    const rootId = component[0]
    romanticComponents.set(rootId, component)
    for (const memberId of component) {
      romanticComponentRootByMemberId.set(memberId, rootId)
    }
  }

  for (let iteration = 0; iteration < entities.length * 8; iteration += 1) {
    let changed = false

    for (const component of romanticComponents.values()) {
      const componentLevel = Math.max(...component.map((id) => levels.get(id) ?? 0))
      for (const memberId of component) {
        const currentLevel = levels.get(memberId) ?? 0
        if (currentLevel !== componentLevel) {
          levels.set(memberId, componentLevel)
          changed = true
        }
      }
    }

    for (const edge of edges) {
      const relationshipType = normalizeRelationshipType(edge.relationship_type)
      if (relationshipType === "family_parent") {
        const parentLevel = levels.get(edge.from_entity_id) ?? 0
        const familyLevel = levels.get(edge.to_entity_id) ?? 0
        const nextFamilyLevel = Math.max(familyLevel, parentLevel + 0.5)
        if (nextFamilyLevel !== familyLevel) {
          levels.set(edge.to_entity_id, nextFamilyLevel)
          changed = true
        }
        continue
      }

      if (relationshipType === "family_child") {
        const fromLevel = levels.get(edge.from_entity_id) ?? 0
        const toLevel = levels.get(edge.to_entity_id) ?? 0
        const nextToLevel = Math.max(toLevel, fromLevel + 0.5)
        if (nextToLevel !== toLevel) {
          levels.set(edge.to_entity_id, nextToLevel)
          changed = true
        }
        continue
      }

      if (relationshipType === "parent_child") {
        const fromLevel = levels.get(edge.from_entity_id) ?? 0
        const toLevel = levels.get(edge.to_entity_id) ?? 0
        const nextToLevel = Math.max(toLevel, fromLevel + 1)
        if (nextToLevel !== toLevel) {
          levels.set(edge.to_entity_id, nextToLevel)
          changed = true
        }
      }
    }

    for (const [dependentId, ownerIds] of petOwnerIdsByDependentId) {
      const ownerLevel = Math.max(...[...ownerIds].map((ownerId) => levels.get(ownerId) ?? 0))
      const dependentLevel = levels.get(dependentId) ?? 0
      const nextDependentLevel = Math.max(dependentLevel, ownerLevel + 1)
      if (nextDependentLevel !== dependentLevel) {
        levels.set(dependentId, nextDependentLevel)
        changed = true
      }
    }

    if (!changed) {
      break
    }
  }

  const minLevel = Math.min(...entities.map((entity) => levels.get(entity.id) ?? 0), 0)
  if (minLevel < 0) {
    for (const entity of entities) {
      levels.set(entity.id, (levels.get(entity.id) ?? 0) - minLevel)
    }
  }

  const familyIdByParentSetSignature = new Map<string, string>()
  for (const [familyId, parentIds] of familyParentIdsByFamilyId) {
    const signature = ownerSetSignature(parentIds)
    if (!familyIdByParentSetSignature.has(signature)) {
      familyIdByParentSetSignature.set(signature, familyId)
    }
  }

  for (const [dependentId, ownerIds] of petOwnerIdsByDependentId) {
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
    const sortedOwnerIds = [...ownerIds].sort(
      (leftId, rightId) => compareEntityIdsByStableOrder(leftId, rightId, entitiesById, birthTimestampById)
    )
    const primaryOwnerId = sortedOwnerIds[0]
    if (primaryOwnerId) {
      addDependent(primaryOwnerId, dependentId)
    }
  }

  for (const [parentId, dependentIds] of dependentsByParentId) {
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
      return compareEntityIdsByStableOrder(a, b, entitiesById, birthTimestampById)
    })
    dependentsByParentId.set(parentId, sortedDependentIds)
  }

  const idsByLevel = new Map<number, string[]>()
  const romanticMemberIds = new Set<string>()
  for (const romanticComponent of romanticComponents.values()) {
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
  for (const [level, ids] of idsByLevel) {
    const sortedIds = [...ids].sort((a, b) => {
      const aPriority = romanticMemberIds.has(a) ? 0 : 1
      const bPriority = romanticMemberIds.has(b) ? 0 : 1
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      const aComponentRootId = romanticComponentRootByMemberId.get(a)
      const bComponentRootId = romanticComponentRootByMemberId.get(b)
      if (aComponentRootId && bComponentRootId && aComponentRootId !== bComponentRootId) {
        return compareEntityIdsByStableOrder(
          aComponentRootId,
          bComponentRootId,
          entitiesById,
          birthTimestampById
        )
      }
      if (aComponentRootId && !bComponentRootId) {
        return -1
      }
      if (!aComponentRootId && bComponentRootId) {
        return 1
      }
      return compareEntityIdsByStableOrder(a, b, entitiesById, birthTimestampById)
    })
    idsByLevel.set(level, sortedIds)
    for (let index = 0; index < sortedIds.length; index += 1) {
      orderRankById.set(sortedIds[index], index)
    }
  }

  const subtreeWidthById = new Map<string, number>()
  const widthVisitingIds = new Set<string>()
  const collectSubtreeIds = (nodeId: string, bucket: Set<string>) => {
    if (bucket.has(nodeId)) {
      return
    }
    bucket.add(nodeId)
    const childIds = dependentsByParentId.get(nodeId) ?? []
    for (const childId of childIds) {
      collectSubtreeIds(childId, bucket)
    }
  }
  const shiftSubtree = (nodeId: string, deltaX: number) => {
    if (deltaX === 0) {
      return
    }
    const subtreeIds = new Set<string>()
    collectSubtreeIds(nodeId, subtreeIds)
    for (const subtreeId of subtreeIds) {
      xById.set(subtreeId, (xById.get(subtreeId) ?? 0) + deltaX)
    }
  }
  const computeSubtreeWidth = (nodeId: string): number => {
    if (subtreeWidthById.has(nodeId)) {
      return subtreeWidthById.get(nodeId) ?? 1
    }
    if (widthVisitingIds.has(nodeId)) {
      return 1
    }
    widthVisitingIds.add(nodeId)
    const childIds = dependentsByParentId.get(nodeId) ?? []
    if (childIds.length === 0) {
      subtreeWidthById.set(nodeId, 1)
      widthVisitingIds.delete(nodeId)
      return 1
    }
    let width = 0
    for (let index = 0; index < childIds.length; index += 1) {
      width += computeSubtreeWidth(childIds[index])
    }
    const resolvedWidth = Math.max(1, width)
    subtreeWidthById.set(nodeId, resolvedWidth)
    widthVisitingIds.delete(nodeId)
    return resolvedWidth
  }

  const assignXWithinSpan = (nodeId: string, leftX: number): number => {
    const nodeWidth = computeSubtreeWidth(nodeId)
    const childIds = dependentsByParentId.get(nodeId) ?? []
    if (childIds.length === 0) {
      xById.set(nodeId, leftX)
      return nodeWidth
    }
    let cursorX = leftX
    for (let index = 0; index < childIds.length; index += 1) {
      const childId = childIds[index]
      const childWidth = computeSubtreeWidth(childId)
      assignXWithinSpan(childId, cursorX)
      cursorX += childWidth
    }
    const spanEndX = leftX + nodeWidth - 1
    xById.set(nodeId, (leftX + spanEndX) / 2)
    return nodeWidth
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
      return compareEntityIdsByStableOrder(leftId, rightId, entitiesById, birthTimestampById)
    })

  let currentLeftX = 0
  for (const rootId of rootIds) {
    const rootWidth = computeSubtreeWidth(rootId)
    assignXWithinSpan(rootId, currentLeftX)
    currentLeftX += rootWidth + 1
  }
  for (const entity of entities) {
    if (!xById.has(entity.id)) {
      xById.set(entity.id, currentLeftX)
      currentLeftX += 1
    }
  }

  const sortedFamilyIds = [...familyParentIdsByFamilyId.keys()].sort(
    (leftId, rightId) => {
      const levelCompare = (levels.get(leftId) ?? 0) - (levels.get(rightId) ?? 0)
      if (levelCompare !== 0) {
        return levelCompare
      }
      return compareEntityIdsByStableOrder(leftId, rightId, entitiesById, birthTimestampById)
    }
  )
  for (const familyId of sortedFamilyIds) {
    const parentIds = familyParentIdsByFamilyId.get(familyId)
    if (!parentIds || parentIds.size === 0) {
      continue
    }
    const parentXs = [...parentIds]
      .map((parentId) => xById.get(parentId))
      .filter((value): value is number => value !== undefined)
    if (parentXs.length === 0) {
      continue
    }
    const targetFamilyX = parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length
    const currentFamilyX = xById.get(familyId) ?? targetFamilyX
    shiftSubtree(familyId, targetFamilyX - currentFamilyX)
  }

  for (const component of romanticComponents.values()) {
    if (component.length <= 1) {
      continue
    }
    const componentLevel = levels.get(component[0]) ?? 0
    if (!component.every((memberId) => (levels.get(memberId) ?? 0) === componentLevel)) {
      continue
    }
    const sortedMemberIds = [...component].sort(
      (leftId, rightId) => compareEntityIdsByStableOrder(leftId, rightId, entitiesById, birthTimestampById)
    )
    const centerX =
      sortedMemberIds.reduce((sum, memberId) => sum + (xById.get(memberId) ?? 0), 0) /
      sortedMemberIds.length
    const startX = centerX - (sortedMemberIds.length - 1) / 2
    for (let index = 0; index < sortedMemberIds.length; index += 1) {
      const memberId = sortedMemberIds[index]
      const targetMemberX = startX + index
      const currentMemberX = xById.get(memberId) ?? targetMemberX
      shiftSubtree(memberId, targetMemberX - currentMemberX)
    }
  }

  const positionedNodes = entities.map((entity) => ({
    id: entity.id,
    x: (xById.get(entity.id) ?? 0) * horizontalSpacing,
    y: (levels.get(entity.id) ?? 0) * verticalSpacing
  }))

  return {
    nodes: positionedNodes,
    edges: edges.map((edge) => {
      const relationshipType = normalizeRelationshipType(edge.relationship_type)
      const fromLevel = levels.get(edge.from_entity_id) ?? 0
      const toLevel = levels.get(edge.to_entity_id) ?? 0
      const midpointY = ((fromLevel + toLevel) / 2) * verticalSpacing

      if (relationshipType === "romantic") {
        return {
          id: edge.id,
          path: {
            kind: "orthogonal_horizontal",
            connectorY: fromLevel * verticalSpacing
          }
        }
      }

      let connectorY = midpointY
      if (relationshipType === "family_parent" || relationshipType === "family_child") {
        const familyId = relationshipType === "family_parent" ? edge.to_entity_id : edge.from_entity_id
        const familyLevel = levels.get(familyId) ?? 0
        connectorY = familyLevel * verticalSpacing
      }

      return {
        id: edge.id,
        path: {
          kind: "orthogonal",
          connectorY
        }
      }
    })
  }
}

export const layouts = {
  graph: graphLayout,
  family_tree: familyTreeLayout
} as const

export type LayoutMode = keyof typeof layouts

function countSegmentCrossings(segments: Array<{ fromX: number; toX: number }>): number {
  let count = 0
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    const left = segments[leftIndex]
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const right = segments[rightIndex]
      const startDelta = left.fromX - right.fromX
      const endDelta = left.toX - right.toX
      if (startDelta * endDelta < 0) {
        count += 1
      }
    }
  }
  return count
}

function estimateFamilyCrossings(input: LayoutInput, output: LayoutOutput): number {
  const xById = new Map(output.nodes.map((node) => [node.id, node.x]))
  const parentSegments: Array<{ fromX: number; toX: number }> = []
  const childSegments: Array<{ fromX: number; toX: number }> = []

  for (const edge of input.edges) {
    const relationshipType = normalizeRelationshipType(edge.relationship_type)
    if (relationshipType !== "family_parent" && relationshipType !== "family_child") {
      continue
    }
    const fromX = xById.get(edge.from_entity_id)
    const toX = xById.get(edge.to_entity_id)
    if (fromX === undefined || toX === undefined) {
      continue
    }

    if (relationshipType === "family_parent") {
      parentSegments.push({ fromX, toX })
    } else {
      childSegments.push({ fromX, toX })
    }
  }

  return countSegmentCrossings(parentSegments) + countSegmentCrossings(childSegments)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function buildNodePositionRecord(nodes: LayoutOutput["nodes"]): PreviousPositions {
  return Object.fromEntries(nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
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

type IncrementalFamilyLayoutInput = {
  baseOutput: LayoutOutput
  previousPositions: PreviousPositions
  previousOrder: PreviousOrder
  previousInput?: LayoutInput
  changeType: Extract<LayoutChangeType, "local_add" | "local_remove">
  addedNodeIds: string[]
  removedNodeIds: string[]
  addedEdgeIds: string[]
  removedEdgeIds: string[]
  config?: LayoutConfig
}

type IncrementalFamilyLayoutResult = {
  output: LayoutOutput
  nextPositions: PreviousPositions
  nextOrder: PreviousOrder
  affectedNodeIds: string[]
}

function mergeOrderPreservingExisting(
  existingOrder: string[] | undefined,
  nextIds: string[],
  xById: Map<string, number>
): string[] {
  const existing = (existingOrder ?? []).filter((id) => nextIds.includes(id))
  const newIds = nextIds.filter((id) => !existing.includes(id))
  if (newIds.length === 0) {
    return existing
  }

  const withBaseX = newIds
    .map((id) => ({ id, x: xById.get(id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((left, right) => {
      if (left.x !== right.x) {
        return left.x - right.x
      }
      return left.id.localeCompare(right.id, "en")
    })

  const merged = [...existing]
  for (const { id } of withBaseX) {
    const insertBeforeIndex = merged.findIndex((existingId) => {
      const currentX = xById.get(existingId) ?? Number.MAX_SAFE_INTEGER
      const nextX = xById.get(id) ?? Number.MAX_SAFE_INTEGER
      return nextX < currentX
    })
    if (insertBeforeIndex === -1) {
      merged.push(id)
    } else {
      merged.splice(insertBeforeIndex, 0, id)
    }
  }

  return merged
}

export function applyIncrementalFamilyTreeLayout(
  input: LayoutInput,
  params: IncrementalFamilyLayoutInput
): IncrementalFamilyLayoutResult {
  const { baseOutput, previousPositions, previousOrder, previousInput, config } = params
  const { horizontalSpacing } = resolveSpacingConfig(config)
  const minGap = horizontalSpacing * 0.92
  const localShiftCap = horizontalSpacing * 0.9
  const entitiesById = new Map(input.entities.map((entity) => [entity.id, entity]))
  const baseNodeById = new Map(baseOutput.nodes.map((node) => [node.id, node]))
  const baseXById = new Map(baseOutput.nodes.map((node) => [node.id, node.x]))
  const currentNodeIds = new Set(input.entities.map((entity) => entity.id))

  const dependentsByParentId = new Map<string, string[]>()
  const parentIdsByDependentId = new Map<string, string[]>()
  const parentIdsByFamilyId = new Map<string, string[]>()
  for (const edge of input.edges) {
    if (normalizeRelationshipType(edge.relationship_type) === "family_parent") {
      const parentIds = parentIdsByFamilyId.get(edge.to_entity_id) ?? []
      parentIds.push(edge.from_entity_id)
      parentIdsByFamilyId.set(edge.to_entity_id, parentIds)
    }
    const relation = resolveParentAndDependent(edge, entitiesById)
    if (!relation) {
      continue
    }
    const existingDependents = dependentsByParentId.get(relation.parentId) ?? []
    if (!existingDependents.includes(relation.dependentId)) {
      existingDependents.push(relation.dependentId)
      dependentsByParentId.set(relation.parentId, existingDependents)
    }
    const existingParents = parentIdsByDependentId.get(relation.dependentId) ?? []
    if (!existingParents.includes(relation.parentId)) {
      existingParents.push(relation.parentId)
      parentIdsByDependentId.set(relation.dependentId, existingParents)
    }
  }

  const changedNodeIds = new Set<string>([
    ...params.addedNodeIds,
    ...params.removedNodeIds
  ])
  const previousEdgesById = new Map((previousInput?.edges ?? []).map((edge) => [edge.id, edge]))
  const currentEdgesById = new Map(input.edges.map((edge) => [edge.id, edge]))
  for (const edgeId of params.addedEdgeIds) {
    const edge = currentEdgesById.get(edgeId)
    if (!edge) {
      continue
    }
    changedNodeIds.add(edge.from_entity_id)
    changedNodeIds.add(edge.to_entity_id)
  }
  for (const edgeId of params.removedEdgeIds) {
    const edge = previousEdgesById.get(edgeId)
    if (!edge) {
      continue
    }
    changedNodeIds.add(edge.from_entity_id)
    changedNodeIds.add(edge.to_entity_id)
  }

  const affectedParentIds = new Set<string>()
  const maybeMarkParent = (nodeId: string) => {
    if (dependentsByParentId.has(nodeId)) {
      affectedParentIds.add(nodeId)
    }
    const directParents = parentIdsByDependentId.get(nodeId) ?? []
    for (const parentId of directParents) {
      affectedParentIds.add(parentId)
    }
    if (nodeId.startsWith("family:")) {
      affectedParentIds.add(nodeId)
    }
  }
  for (const nodeId of changedNodeIds) {
    maybeMarkParent(nodeId)
  }

  const affectedNodeIds = new Set<string>()
  for (const parentId of affectedParentIds) {
    affectedNodeIds.add(parentId)
    const dependents = dependentsByParentId.get(parentId) ?? []
    for (const dependentId of dependents) {
      affectedNodeIds.add(dependentId)
    }
    const familyParents = parentIdsByFamilyId.get(parentId) ?? []
    for (const familyParentId of familyParents) {
      affectedNodeIds.add(familyParentId)
    }
  }
  for (const nodeId of params.addedNodeIds) {
    affectedNodeIds.add(nodeId)
  }

  const nextXById = new Map<string, number>()
  const nextYById = new Map<string, number>()

  for (const node of baseOutput.nodes) {
    if (!affectedNodeIds.has(node.id) && previousPositions[node.id]) {
      nextXById.set(node.id, previousPositions[node.id].x)
      nextYById.set(node.id, previousPositions[node.id].y)
      continue
    }
    const previous = previousPositions[node.id]
    if (previous) {
      const targetX = previous.x + clamp(node.x - previous.x, -localShiftCap, localShiftCap)
      nextXById.set(node.id, targetX)
      nextYById.set(node.id, previous.y + clamp(node.y - previous.y, -localShiftCap, localShiftCap))
    } else {
      nextXById.set(node.id, node.x)
      nextYById.set(node.id, node.y)
    }
  }

  const nextOrder = deriveFamilyOrderFromLayout(input, baseOutput)
  for (const [parentId, dependents] of dependentsByParentId) {
    const preserved = mergeOrderPreservingExisting(previousOrder[parentId], dependents, baseXById)
    nextOrder[parentId] = preserved
  }

  for (const parentId of affectedParentIds) {
    const orderedDependents = nextOrder[parentId] ?? []
    if (orderedDependents.length === 0) {
      continue
    }
    const parentX = nextXById.get(parentId) ?? baseNodeById.get(parentId)?.x ?? 0
    const startX = parentX - ((orderedDependents.length - 1) / 2) * horizontalSpacing
    for (let index = 0; index < orderedDependents.length; index += 1) {
      const dependentId = orderedDependents[index]
      if (!currentNodeIds.has(dependentId)) {
        continue
      }
      const currentX = nextXById.get(dependentId) ?? startX + index * horizontalSpacing
      const targetX = startX + index * horizontalSpacing
      const maxShift = previousPositions[dependentId] ? localShiftCap : horizontalSpacing
      nextXById.set(dependentId, currentX + clamp(targetX - currentX, -maxShift, maxShift))
    }
  }

  for (const [familyId, parentIds] of parentIdsByFamilyId) {
    if (parentIds.length === 0 || !nextXById.has(familyId)) {
      continue
    }
    const parentXs = parentIds
      .map((parentId) => nextXById.get(parentId))
      .filter((value): value is number => value !== undefined)
    if (parentXs.length === 0) {
      continue
    }
    const anchoredX = parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length
    const currentX = nextXById.get(familyId) ?? anchoredX
    const maxShift = previousPositions[familyId] ? localShiftCap : horizontalSpacing
    nextXById.set(familyId, currentX + clamp(anchoredX - currentX, -maxShift, maxShift))
  }

  const levelById = new Map(
    baseOutput.nodes.map((node) => [node.id, Math.round(node.y / (config?.verticalSpacing ?? VERTICAL_SPACING))])
  )
  const levelIds = new Map<number, string[]>()
  for (const node of baseOutput.nodes) {
    const level = levelById.get(node.id) ?? 0
    const ids = levelIds.get(level) ?? []
    ids.push(node.id)
    levelIds.set(level, ids)
  }
  for (const ids of levelIds.values()) {
    const sortedIds = [...ids].sort((leftId, rightId) => (nextXById.get(leftId) ?? 0) - (nextXById.get(rightId) ?? 0))
    for (let index = 1; index < sortedIds.length; index += 1) {
      const leftId = sortedIds[index - 1]
      const rightId = sortedIds[index]
      const leftX = nextXById.get(leftId) ?? 0
      const rightX = nextXById.get(rightId) ?? 0
      const delta = rightX - leftX
      if (delta >= minGap) {
        continue
      }
      if (!affectedNodeIds.has(rightId)) {
        continue
      }
      nextXById.set(rightId, leftX + minGap)
    }
  }

  const nodes = baseOutput.nodes.map((node) => ({
    id: node.id,
    x: nextXById.get(node.id) ?? node.x,
    y: nextYById.get(node.id) ?? node.y
  }))

  const nextPositions = buildNodePositionRecord(nodes)
  return {
    output: {
      nodes,
      edges: baseOutput.edges
    },
    nextPositions,
    nextOrder,
    affectedNodeIds: [...affectedNodeIds]
  }
}

export function applyFamilyTreeMinimalMovement(
  input: LayoutInput,
  baseOutput: LayoutOutput,
  previousPositions: PreviousPositions,
  config?: LayoutConfig
): LayoutOutput {
  const { horizontalSpacing, verticalSpacing } = resolveSpacingConfig(config)
  const minGap = horizontalSpacing * 0.92
  const maxExistingShiftX = horizontalSpacing * 0.7
  const maxExistingShiftY = verticalSpacing * 0.5

  const nodesById = new Map(baseOutput.nodes.map((node) => [node.id, node]))
  const entitiesById = new Map(input.entities.map((entity) => [entity.id, entity]))

  const xById = new Map<string, number>()
  const yById = new Map<string, number>()
  const levelById = new Map<string, number>()
  const idsByLevel = new Map<number, string[]>()

  for (const node of baseOutput.nodes) {
    const level = Math.round(node.y / verticalSpacing)
    levelById.set(node.id, level)
    const ids = idsByLevel.get(level) ?? []
    ids.push(node.id)
    idsByLevel.set(level, ids)
  }

  const sortByBaseOrder = (leftId: string, rightId: string): number => {
    const leftNode = nodesById.get(leftId)
    const rightNode = nodesById.get(rightId)
    if (!leftNode || !rightNode) {
      return leftId.localeCompare(rightId, "en")
    }
    if (leftNode.x !== rightNode.x) {
      return leftNode.x - rightNode.x
    }
    return leftId.localeCompare(rightId, "en")
  }

  const neighborIdsById = new Map<string, Set<string>>()
  const registerNeighbor = (leftId: string, rightId: string) => {
    if (!neighborIdsById.has(leftId)) {
      neighborIdsById.set(leftId, new Set<string>())
    }
    neighborIdsById.get(leftId)?.add(rightId)
  }

  const parentIdsByFamilyId = new Map<string, string[]>()
  for (const edge of input.edges) {
    registerNeighbor(edge.from_entity_id, edge.to_entity_id)
    registerNeighbor(edge.to_entity_id, edge.from_entity_id)
    if (normalizeRelationshipType(edge.relationship_type) === "family_parent") {
      const parentIds = parentIdsByFamilyId.get(edge.to_entity_id) ?? []
      parentIds.push(edge.from_entity_id)
      parentIdsByFamilyId.set(edge.to_entity_id, parentIds)
    }
  }

  const isExisting = (id: string): boolean => previousPositions[id] !== undefined

  const resolveTargetX = (id: string): number => {
    const baseX = nodesById.get(id)?.x ?? 0
    const previous = previousPositions[id]
    if (!previous) {
      const neighbors = [...(neighborIdsById.get(id) ?? new Set<string>())]
        .map((neighborId) => xById.get(neighborId) ?? previousPositions[neighborId]?.x)
        .filter((value): value is number => value !== undefined)
      if (neighbors.length > 0) {
        const anchorX = neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length
        return (anchorX + baseX) / 2
      }
      return baseX
    }
    const delta = baseX - previous.x
    return previous.x + clamp(delta, -maxExistingShiftX, maxExistingShiftX)
  }

  const resolveTargetY = (id: string): number => {
    const baseY = nodesById.get(id)?.y ?? 0
    const previous = previousPositions[id]
    if (!previous) {
      return baseY
    }
    return previous.y + clamp(baseY - previous.y, -maxExistingShiftY, maxExistingShiftY)
  }

  for (const [level, levelIds] of idsByLevel) {
    const sortedIds = [...levelIds].sort(sortByBaseOrder)
    const targetXById = new Map(sortedIds.map((id) => [id, resolveTargetX(id)]))

    let cursorX: number | null = null
    for (const id of sortedIds) {
      const targetX = targetXById.get(id) ?? 0
      if (cursorX === null) {
        xById.set(id, targetX)
        cursorX = targetX
        continue
      }
      const nextX = Math.max(targetX, cursorX + minGap)
      xById.set(id, nextX)
      cursorX = nextX
    }

    for (const id of sortedIds) {
      yById.set(id, resolveTargetY(id))
    }

    idsByLevel.set(level, sortedIds)
  }

  for (const [familyId, parentIds] of parentIdsByFamilyId) {
    if (parentIds.length === 0) {
      continue
    }
    const parentXs = parentIds
      .map((parentId) => xById.get(parentId))
      .filter((value): value is number => value !== undefined)
    if (parentXs.length === 0 || !xById.has(familyId)) {
      continue
    }
    const anchoredX = parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length
    const currentX = xById.get(familyId) ?? anchoredX
    const maxShift = isExisting(familyId) ? maxExistingShiftX : horizontalSpacing
    xById.set(familyId, currentX + clamp(anchoredX - currentX, -maxShift, maxShift))
  }

  for (const [, sortedIds] of idsByLevel) {
    let cursorX: number | null = null
    for (const id of sortedIds) {
      const candidate = xById.get(id) ?? 0
      if (cursorX === null) {
        cursorX = candidate
        xById.set(id, candidate)
        continue
      }
      const nextX = Math.max(candidate, cursorX + minGap)
      xById.set(id, nextX)
      cursorX = nextX
    }

    // Compact locally on removal without global recentering.
    for (let index = sortedIds.length - 2; index >= 0; index -= 1) {
      const id = sortedIds[index]
      const nextId = sortedIds[index + 1]
      const currentX = xById.get(id) ?? 0
      const nextX = xById.get(nextId) ?? currentX + minGap
      const maxAllowed = nextX - minGap
      if (currentX > maxAllowed) {
        xById.set(id, maxAllowed)
      }
    }
  }

  const nodes = baseOutput.nodes.map((node) => {
    const entityKind = entitiesById.get(node.id)?.entity_kind
    const resolvedX = xById.get(node.id) ?? node.x
    const resolvedY = yById.get(node.id) ?? node.y
    // Keep family nodes on explicit half-level lines from the base layout.
    if (entityKind === "family") {
      return { id: node.id, x: resolvedX, y: node.y }
    }
    return { id: node.id, x: resolvedX, y: resolvedY }
  })

  return {
    nodes,
    edges: baseOutput.edges
  }
}

function resolveFamilyLayoutFallbackReason(
  input: LayoutInput,
  output: LayoutOutput
): ResolvedLayout["fallbackReason"] | null {
  const parentIdsByFamilyId = new Map<string, Set<string>>()
  const familyIdsByChildId = new Map<string, Set<string>>()

  for (const edge of input.edges) {
    const relationshipType = normalizeRelationshipType(edge.relationship_type)
    if (relationshipType === "family_parent") {
      const familyId = edge.to_entity_id
      if (!parentIdsByFamilyId.has(familyId)) {
        parentIdsByFamilyId.set(familyId, new Set<string>())
      }
      parentIdsByFamilyId.get(familyId)?.add(edge.from_entity_id)
      continue
    }

    if (relationshipType === "family_child") {
      const childId = edge.to_entity_id
      if (!familyIdsByChildId.has(childId)) {
        familyIdsByChildId.set(childId, new Set<string>())
      }
      familyIdsByChildId.get(childId)?.add(edge.from_entity_id)
    }
  }

  for (const parentIds of parentIdsByFamilyId.values()) {
    if (parentIds.size > MAX_PARENTS_PER_FAMILY) {
      return "too_many_parents"
    }
  }

  for (const familyIds of familyIdsByChildId.values()) {
    if (familyIds.size > 1) {
      return "unsupported_structure"
    }
  }

  const crossings = estimateFamilyCrossings(input, output)
  if (crossings > MAX_FAMILY_LAYOUT_CROSSINGS) {
    return "excessive_crossing"
  }

  return null
}

export function resolveLayoutWithFallback(
  requestedMode: LayoutMode,
  input: LayoutInput,
  config?: LayoutConfig
): ResolvedLayout {
  if (requestedMode !== "family_tree") {
    return {
      requestedMode,
      resolvedMode: requestedMode,
      output: layouts[requestedMode](input, config)
    }
  }

  try {
    const familyOutput = familyTreeLayout(input, config)
    const fallbackReason = resolveFamilyLayoutFallbackReason(input, familyOutput)
    if (fallbackReason) {
      return {
        requestedMode,
        resolvedMode: "graph",
        output: graphLayout(input, config),
        fallbackReason
      }
    }

    return {
      requestedMode,
      resolvedMode: requestedMode,
      output: familyOutput
    }
  } catch {
    return {
      requestedMode,
      resolvedMode: "graph",
      output: graphLayout(input, config),
      fallbackReason: "layout_error"
    }
  }
}
