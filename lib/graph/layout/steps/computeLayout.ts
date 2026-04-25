import {
  isFamilyChildRelationshipType,
  isFamilyParentRelationshipType,
  isParentChildRelationshipType,
  isRomanticRelationshipType
} from "@/lib/graph/semantics/relationshipSemantics"
import type { FamilyTreeConstraints } from "@/lib/graph/layout/steps/applyConstraints"
import type { FamilyTreeStructure } from "@/lib/graph/layout/steps/buildStructure"
import type { Edge, Entity } from "@/types"

import type { LayoutStage } from "@/lib/graph/layout/pipeline"

type FamilyLayoutLike = {
  nodes: { id: string; x: number; y: number }[]
  edges: { id: string; path?: unknown }[]
  anchorPositionsById?: Record<string, { x: number; y: number }>
  nodePositionsById?: Record<string, { x: number; y: number }>
}

type OrderedFamilyData = {
  dependentsByParentId?: Map<string, string[]>
  parentByDependentId?: Map<string, string>
  orderRankById?: Map<string, number>
  visualDependentsByParentId?: Map<string, string[]>
  primarySiblingSet?: Set<string>
  rootIds?: string[]
  familyIds?: string[]
  romanticComponentMemberIdsByRootId?: Map<string, string[]>
  orderedParentIdsByFamilyId?: Map<string, string[]>
}

function enforceRomanticAdjacency(
  partnerIdsByEntityId: Map<string, Set<string>>,
  xById: Map<string, number>,
  levels: Map<string, number>,
  shiftSubtree: (nodeId: string, deltaX: number) => void,
  options?: {
    protectedIds?: Set<string>
  }
) {
  const protectedIds = options?.protectedIds ?? new Set<string>()
  const processedPairs = new Set<string>()
  for (const [leftId, partnerIds] of partnerIdsByEntityId) {
    for (const rightId of partnerIds) {
      const pairKey = leftId < rightId ? `${leftId}|${rightId}` : `${rightId}|${leftId}`
      if (processedPairs.has(pairKey)) {
        continue
      }
      processedPairs.add(pairKey)

      const leftX = xById.get(leftId)
      const rightX = xById.get(rightId)
      if (leftX === undefined || rightX === undefined) {
        continue
      }
      const leftLevel = levels.get(leftId)
      const rightLevel = levels.get(rightId)
      if (leftLevel === undefined || rightLevel === undefined || leftLevel !== rightLevel) {
        continue
      }
      const delta = rightX - leftX
      if (Math.abs(Math.abs(delta) - 1) < 1e-6) {
        continue
      }

      const leftProtected = protectedIds.has(leftId)
      const rightProtected = protectedIds.has(rightId)
      if (leftProtected && rightProtected) {
        continue
      }
      if (leftProtected) {
        const targetRightX = leftX + (delta >= 0 ? 1 : -1)
        shiftSubtree(rightId, targetRightX - rightX)
        continue
      }
      if (rightProtected) {
        const targetLeftX = rightX - (delta >= 0 ? 1 : -1)
        shiftSubtree(leftId, targetLeftX - leftX)
        continue
      }

      if (Math.abs(delta) < 1e-6) {
        shiftSubtree(rightId, 1)
        continue
      }
      const targetRightX = leftX + (delta > 0 ? 1 : -1)
      shiftSubtree(rightId, targetRightX - rightX)
    }
  }
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

function cloneDependentsMap(source?: Map<string, string[]>): Map<string, string[]> {
  if (!source) {
    return new Map<string, string[]>()
  }
  return new Map([...source.entries()].map(([parentId, dependentIds]) => [parentId, [...dependentIds]]))
}

function existingComputeLayoutLogic(
  entities: Entity[],
  edges: Edge[],
  structure: FamilyTreeStructure | undefined,
  constrained: FamilyTreeConstraints | undefined,
  ordered: OrderedFamilyData | undefined,
  _previousPositions: unknown,
  spacing: { horizontalSpacing: number; verticalSpacing: number }
): FamilyLayoutLike {
  const levels = constrained?.levels
    ? new Map(constrained.levels)
    : new Map<string, number>(entities.map((entity) => [entity.id, 0]))
  const xById = new Map<string, number>()

  const familyParentIdsByFamilyId = structure?.familyParentIdsByFamilyId ?? new Map<string, Set<string>>()
  const romanticPartnerIdsByEntityId =
    structure?.romanticPartnerIdsByEntityId ?? collectRomanticPartnerIdsByEntityId(edges)
  const romanticComponents = structure?.romanticComponents ?? new Map<string, string[]>()

  const dependentsByParentId = ordered?.dependentsByParentId
    ? cloneDependentsMap(ordered.dependentsByParentId)
    : cloneDependentsMap(structure?.dependentsByParentId)
  const parentByDependentId = ordered?.parentByDependentId
    ? new Map(ordered.parentByDependentId)
    : structure?.parentByDependentId
        ? new Map(structure.parentByDependentId)
        : new Map<string, string>()
  const visualDependentsByParentId = ordered?.visualDependentsByParentId
    ? cloneDependentsMap(ordered.visualDependentsByParentId)
      : cloneDependentsMap(dependentsByParentId)
  const primarySiblingSet = ordered?.primarySiblingSet
    ? new Set(ordered.primarySiblingSet)
      : new Set<string>()

  for (const anchor of structure?.anchors ?? []) {
    if (!levels.has(anchor.id)) {
      levels.set(anchor.id, 0)
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

  const rootIds =
    ordered?.rootIds && ordered.rootIds.length > 0
      ? [...ordered.rootIds]
      : entities.map((entity) => entity.id).filter((entityId) => !parentByDependentId.has(entityId))

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

  for (const component of romanticComponents.values()) {
    if (component.length <= 1) {
      continue
    }
    const componentLevel = levels.get(component[0]) ?? 0
    if (!component.every((memberId) => (levels.get(memberId) ?? 0) === componentLevel)) {
      continue
    }
    const rootId = structure?.romanticComponentRootByMemberId.get(component[0]) ?? component[0]
    const sortedMemberIds = ordered?.romanticComponentMemberIdsByRootId?.get(rootId) ?? [...component]
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

  const sortedFamilyIds =
    ordered?.familyIds && ordered.familyIds.length > 0
      ? [...ordered.familyIds]
      : [...familyParentIdsByFamilyId.keys()]

  const placeAnchorDependents = (familyId: string) => {
    const parentIds = ordered?.orderedParentIdsByFamilyId?.get(familyId) ?? [
      ...(familyParentIdsByFamilyId.get(familyId) ?? new Set<string>())
    ]
    if (parentIds.length === 0) {
      return
    }
    const parentXs = parentIds
      .map((parentId) => xById.get(parentId))
      .filter((value): value is number => value !== undefined)
    if (parentXs.length === 0) {
      return
    }

    const anchoredFamilyX = parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length
    xById.set(familyId, anchoredFamilyX)

    const dependentIds = visualDependentsByParentId.get(familyId) ?? []
    if (dependentIds.length === 0) {
      return
    }

    const totalWidth = dependentIds.reduce((sum, dependentId) => sum + computeSubtreeWidth(dependentId), 0)
    let cursorX = anchoredFamilyX - (totalWidth - 1) / 2
    for (const dependentId of dependentIds) {
      const dependentWidth = computeSubtreeWidth(dependentId)
      const targetDependentX = cursorX + (dependentWidth - 1) / 2
      const currentDependentX = xById.get(dependentId) ?? targetDependentX
      shiftSubtree(dependentId, targetDependentX - currentDependentX)
      cursorX += dependentWidth
    }
  }

  for (const familyId of sortedFamilyIds) {
    placeAnchorDependents(familyId)
  }

  const SUBTREE_GAP = 1
  const orderedDependentsOf = (parentId: string): string[] =>
    visualDependentsByParentId.get(parentId) ?? dependentsByParentId.get(parentId) ?? []
  const computeSubtreeBounds = (nodeId: string): { minX: number; maxX: number } => {
    const subtreeIds = new Set<string>()
    collectSubtreeIds(nodeId, subtreeIds)
    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    for (const subtreeId of subtreeIds) {
      const x = xById.get(subtreeId)
      if (x === undefined) {
        continue
      }
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      const x = xById.get(nodeId) ?? 0
      return { minX: x, maxX: x }
    }
    return { minX, maxX }
  }
  const realignFamilyAnchors = () => {
    for (const familyId of sortedFamilyIds) {
      const parentIds = ordered?.orderedParentIdsByFamilyId?.get(familyId) ?? [
        ...(familyParentIdsByFamilyId.get(familyId) ?? new Set<string>())
      ]
      if (parentIds.length === 0) {
        continue
      }
      const parentXs = parentIds
        .map((parentId) => xById.get(parentId))
        .filter((value): value is number => value !== undefined)
      if (parentXs.length === 0) {
        continue
      }
      const anchoredFamilyX = parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length
      const currentFamilyX = xById.get(familyId) ?? anchoredFamilyX
      shiftSubtree(familyId, anchoredFamilyX - currentFamilyX)
    }
  }
  const enforceSiblingIsolation = () => {
    const visitedParents = new Set<string>()
    const isolate = (parentId: string) => {
      if (visitedParents.has(parentId)) {
        return
      }
      visitedParents.add(parentId)
      const dependentIds = orderedDependentsOf(parentId).filter((dependentId) => xById.has(dependentId))
      for (const dependentId of dependentIds) {
        isolate(dependentId)
      }
      let previousMaxX: number | null = null
      for (const dependentId of dependentIds) {
        const bounds = computeSubtreeBounds(dependentId)
        if (previousMaxX !== null && bounds.minX < previousMaxX + SUBTREE_GAP) {
          shiftSubtree(dependentId, previousMaxX + SUBTREE_GAP - bounds.minX)
        }
        previousMaxX = computeSubtreeBounds(dependentId).maxX
      }
    }
    for (const rootId of rootIds) {
      isolate(rootId)
    }
    for (const entity of entities) {
      isolate(entity.id)
    }
  }
  const enforceDependentOrder = () => {
    for (const [parentId, dependentIds] of dependentsByParentId) {
      const visibleDependentIds = dependentIds.filter((dependentId) => xById.has(dependentId))
      for (let index = 1; index < visibleDependentIds.length; index += 1) {
        const leftId = visibleDependentIds[index - 1]
        const rightId = visibleDependentIds[index]
        const leftX = xById.get(leftId)
        const rightX = xById.get(rightId)
        if (leftX === undefined || rightX === undefined) {
          continue
        }
        if (rightX <= leftX) {
          shiftSubtree(rightId, leftX + 1 - rightX)
        }
      }
      if (!xById.has(parentId)) {
        continue
      }
    }
  }

  for (let iteration = 0; iteration < 2; iteration += 1) {
    realignFamilyAnchors()
    enforceSiblingIsolation()
    enforceDependentOrder()
  }
  realignFamilyAnchors()

  enforceRomanticAdjacency(romanticPartnerIdsByEntityId, xById, levels, shiftSubtree, {
    protectedIds: primarySiblingSet
  })
  for (const familyId of sortedFamilyIds) {
    placeAnchorDependents(familyId)
  }
  enforceSiblingIsolation()
  enforceDependentOrder()
  realignFamilyAnchors()

  const nodes = entities.map((entity) => ({
    id: entity.id,
    x: (xById.get(entity.id) ?? 0) * spacing.horizontalSpacing,
    y: (levels.get(entity.id) ?? 0) * spacing.verticalSpacing
  }))

  return {
    nodes,
    edges: edges.map((edge) => ({ id: edge.id })),
    nodePositionsById: Object.fromEntries(nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
  }
}

function buildVirtualFamilyGraph(
  entities: Entity[],
  edges: Edge[],
  structure: FamilyTreeStructure | undefined
): { entities: Entity[]; edges: Edge[]; anchorIds: Set<string> } {
  const anchorIds = new Set<string>(structure?.anchors.map((anchor) => anchor.id) ?? [])
  if (!structure || structure.anchors.length === 0) {
    return { entities, edges, anchorIds }
  }

  const virtualEntities = [...entities]
  for (const anchor of structure.anchors) {
    virtualEntities.push({
      id: anchor.id,
      entity_kind: "person",
      display_name: "Anchor"
    })
  }

  const passthroughEdges = edges.filter(
    (edge) =>
      !isParentChildRelationshipType(edge.relationship_type) &&
      !isFamilyParentRelationshipType(edge.relationship_type) &&
      !isFamilyChildRelationshipType(edge.relationship_type)
  )

  const virtualEdges: Edge[] = []
  for (const anchor of structure.anchors) {
    for (const parentId of anchor.parentIds) {
      virtualEdges.push({
        id: `anchor-parent:${parentId}:${anchor.id}`,
        relationship_type: "family_parent",
        from_entity_id: parentId,
        to_entity_id: anchor.id,
        roles: { from: "parent", to: "family" },
        active: true,
        start: "1900-01-01T00:00:00.000Z",
        end: null
      })
    }
    for (const childId of anchor.childIds) {
      virtualEdges.push({
        id: `anchor-child:${anchor.id}:${childId}`,
        relationship_type: "family_child",
        from_entity_id: anchor.id,
        to_entity_id: childId,
        roles: { from: "family", to: "child" },
        active: true,
        start: "1900-01-01T00:00:00.000Z",
        end: null
      })
    }
  }

  return {
    entities: [...new Map(virtualEntities.map((entity) => [entity.id, entity])).values()],
    edges: [...new Map([...passthroughEdges, ...virtualEdges].map((edge) => [edge.id, edge])).values()],
    anchorIds
  }
}

function stabilizeWithPreviousPositions(
  layout: FamilyLayoutLike,
  previousPositions: Record<string, { x: number; y: number }> | undefined,
  structure: FamilyTreeStructure | undefined,
  constrained: FamilyTreeConstraints | undefined,
  verticalSpacing: number
): FamilyLayoutLike {
  if (!previousPositions || Object.keys(previousPositions).length === 0) {
    return layout
  }

  const currentNodeIds = new Set(layout.nodes.map((node) => node.id))
  const previousNodeIds = new Set(Object.keys(previousPositions))
  const stayingNodes = [...currentNodeIds].filter((id) => previousNodeIds.has(id))
  const enteringNodes = [...currentNodeIds].filter((id) => !previousNodeIds.has(id))
  const exitingNodes = [...previousNodeIds].filter((id) => !currentNodeIds.has(id))
  if (stayingNodes.length === 0 || (enteringNodes.length === 0 && exitingNodes.length === 0)) {
    return layout
  }

  const blendAlpha = 0.3
  const blendedNodes = layout.nodes.map((node) => {
    const previous = previousPositions[node.id]
    if (!previous) {
      return node
    }
    return {
      id: node.id,
      x: previous.x + (node.x - previous.x) * blendAlpha,
      y: node.y
    }
  })

  const levels = constrained?.levels
  const blendedNodePositionById = Object.fromEntries(blendedNodes.map((node) => [node.id, { x: node.x, y: node.y }]))
  const anchorPositionsById = Object.fromEntries(
    (structure?.anchors ?? []).map((anchor) => {
      const parentXs = anchor.parentIds
        .map((parentId) => blendedNodePositionById[parentId]?.x)
        .filter((value): value is number => value !== undefined)
      const anchorX =
        parentXs.length > 0
          ? parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length
          : layout.anchorPositionsById?.[anchor.id]?.x ?? 0
      const anchorY = levels
        ? (levels.get(anchor.id) ?? ((levels.get(anchor.parentIds[0] ?? "") ?? 0) + 0.5)) * verticalSpacing
        : layout.anchorPositionsById?.[anchor.id]?.y ?? 0
      return [anchor.id, { x: anchorX, y: anchorY }]
    })
  )

  return {
    ...layout,
    nodes: blendedNodes,
    anchorPositionsById,
    nodePositionsById: {
      ...(layout.nodePositionsById ?? {}),
      ...blendedNodePositionById
    }
  }
}

export const computeLayout: LayoutStage = (ctx) => {
  const { entities, edges, structure, constrained, ordered, previousPositions } = ctx
  const familyStructure = structure as FamilyTreeStructure | undefined
  const virtualGraph = buildVirtualFamilyGraph(entities, edges, familyStructure)

  const usesLegacyLayout = false
  if (usesLegacyLayout) {
    throw new Error("Legacy layout should not be invoked")
  }

  const computed = existingComputeLayoutLogic(
    virtualGraph.entities,
    virtualGraph.edges,
    familyStructure,
    constrained as FamilyTreeConstraints | undefined,
    ordered as OrderedFamilyData | undefined,
    previousPositions,
    {
      horizontalSpacing: ctx.layoutConfig?.horizontalSpacing ?? 100,
      verticalSpacing: ctx.layoutConfig?.verticalSpacing ?? 180
    }
  )

  const anchorPositionsById = Object.fromEntries(
    computed.nodes
      .filter((node) => virtualGraph.anchorIds.has(node.id))
      .map((node) => [node.id, { x: node.x, y: node.y }])
  )
  const layout: FamilyLayoutLike = {
    nodes: computed.nodes.filter((node) => !virtualGraph.anchorIds.has(node.id)),
    edges: computed.edges,
    anchorPositionsById,
    nodePositionsById: Object.fromEntries(computed.nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
  }
  const stabilizedLayout = stabilizeWithPreviousPositions(
    layout,
    previousPositions,
    familyStructure,
    constrained as FamilyTreeConstraints | undefined,
    ctx.layoutConfig?.verticalSpacing ?? 180
  )

  return {
    ...ctx,
    layout: stabilizedLayout
  }
}
