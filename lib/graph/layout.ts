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
    ids.sort((a, b) => {
      const aLabel = entitiesById.get(a)?.display_name ?? a
      const bLabel = entitiesById.get(b)?.display_name ?? b
      return aLabel.localeCompare(bLabel)
    })

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
  const entityOrderById = new Map(entities.map((entity, index) => [entity.id, index]))
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
    component.sort(
      (a, b) =>
        (entityOrderById.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (entityOrderById.get(b) ?? Number.MAX_SAFE_INTEGER)
    )
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
      (leftId, rightId) =>
        (entityOrderById.get(leftId) ?? Number.MAX_SAFE_INTEGER) -
        (entityOrderById.get(rightId) ?? Number.MAX_SAFE_INTEGER)
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
      return (entityOrderById.get(a) ?? Number.MAX_SAFE_INTEGER) - (entityOrderById.get(b) ?? Number.MAX_SAFE_INTEGER)
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
        return (entityOrderById.get(aComponentRootId) ?? Number.MAX_SAFE_INTEGER) - (entityOrderById.get(bComponentRootId) ?? Number.MAX_SAFE_INTEGER)
      }
      if (aComponentRootId && !bComponentRootId) {
        return -1
      }
      if (!aComponentRootId && bComponentRootId) {
        return 1
      }
      return (entityOrderById.get(a) ?? Number.MAX_SAFE_INTEGER) - (entityOrderById.get(b) ?? Number.MAX_SAFE_INTEGER)
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
      const leftOrder = orderRankById.get(leftId) ?? (entityOrderById.get(leftId) ?? Number.MAX_SAFE_INTEGER)
      const rightOrder = orderRankById.get(rightId) ?? (entityOrderById.get(rightId) ?? Number.MAX_SAFE_INTEGER)
      return leftOrder - rightOrder
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
    (leftId, rightId) => (levels.get(leftId) ?? 0) - (levels.get(rightId) ?? 0)
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
      (leftId, rightId) => (entityOrderById.get(leftId) ?? Number.MAX_SAFE_INTEGER) - (entityOrderById.get(rightId) ?? Number.MAX_SAFE_INTEGER)
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
