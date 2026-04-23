import { createHash } from "node:crypto"

import { and, eq, inArray } from "drizzle-orm"

import { getDb } from "@/db/client"
import { entity, relationship, relationshipInterval, relationshipParticipant, relationshipType } from "@/db/schema"
import type { Edge, Entity, GraphResponse } from "@/types"

type BuildGraphDeltaInput = {
  graphId: string
  centerEntityId: string
  asOf: string
  depth: number
  alreadyLoadedEntityIds: Set<string>
  alreadyLoadedRelationshipIds: Set<string>
  allowedEntityKinds: Set<string> | null
  allowedRelationshipTypes: Set<string> | null
  includeInactive: boolean
}

type EntityRow = {
  id: string
  entityKind: "person" | "animal" | "place"
  canonicalDisplayName: string
}

type RelationshipRow = {
  id: string
  relationshipType: string
}

type RelationshipParticipantRow = {
  relationshipId: string
  entityId: string
  role: string
}

type RelationshipIntervalRow = {
  relationshipId: string
  validFrom: string
  validTo: string | null
}

type RelationshipBundle = {
  relationship: RelationshipRow
  participants: RelationshipParticipantRow[]
  intervals: RelationshipIntervalRow[]
}

const TIMELESS_RELATIONSHIP_START = "1900-01-01T00:00:00.000Z"
const FAMILY_NODE_DISPLAY_NAME = "Family"

export type FamilyNode = {
  id: string
  entity_kind: "family"
}

type FamilyGroup = {
  familyNode: FamilyNode
  parentIds: string[]
  childIds: string[]
}

function normalizeRelationshipType(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_")
}

function isParentChildRelationship(edge: Edge): boolean {
  return normalizeRelationshipType(edge.relationship_type) === "parent_child"
}

function isSiblingRelationship(edge: Edge): boolean {
  return normalizeRelationshipType(edge.relationship_type) === "sibling"
}

function toGraphEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    entity_kind: row.entityKind,
    display_name: row.canonicalDisplayName
  }
}

function toRelationshipParticipantMap(participants: RelationshipParticipantRow[]): Map<string, string> {
  const participantMap = new Map<string, string>()
  for (const participant of participants) {
    if (!participantMap.has(participant.entityId)) {
      participantMap.set(participant.entityId, participant.role)
    }
  }

  return participantMap
}

function resolveRelationshipEdge(
  bundle: RelationshipBundle,
  asOfTime: number,
  entityById: Map<string, EntityRow>,
  allowedEntityKinds: Set<string> | null,
  allowedRelationshipTypes: Set<string> | null,
  includeInactive: boolean
): Edge | null {
  if (allowedRelationshipTypes && !allowedRelationshipTypes.has(bundle.relationship.relationshipType)) {
    return null
  }

  const participantMap = toRelationshipParticipantMap(bundle.participants)
  const participantIds = [...participantMap.keys()].sort()
  if (participantIds.length < 2) {
    return null
  }

  const fromEntityId = participantIds[0]
  const toEntityId = participantIds[1]
  const fromEntity = entityById.get(fromEntityId)
  const toEntity = entityById.get(toEntityId)

  if (!fromEntity || !toEntity) {
    return null
  }

  if (
    allowedEntityKinds &&
    (!allowedEntityKinds.has(fromEntity.entityKind) || !allowedEntityKinds.has(toEntity.entityKind))
  ) {
    return null
  }

  const hasTemporalIntervals = bundle.intervals.length > 0
  const activeIntervals = bundle.intervals.filter((interval) => {
    const startTime = Date.parse(interval.validFrom)
    const endTime = interval.validTo ? Date.parse(interval.validTo) : Number.POSITIVE_INFINITY
    return Number.isFinite(startTime) && startTime <= asOfTime && endTime >= asOfTime
  })

  const isActive = !hasTemporalIntervals || activeIntervals.length > 0
  if (!includeInactive && !isActive) {
    return null
  }

  const selectedIntervals = hasTemporalIntervals ? (isActive ? activeIntervals : bundle.intervals) : []

  const sortedByStart = [...selectedIntervals].sort(
    (a, b) => Date.parse(a.validFrom) - Date.parse(b.validFrom)
  )
  const firstInterval = sortedByStart[0]
  const anyOpenEnded = sortedByStart.some((interval) => interval.validTo === null)
  const endingTimes = sortedByStart
    .map((interval) => interval.validTo)
    .filter((value): value is string => value !== null)
    .sort((a, b) => Date.parse(a) - Date.parse(b))

  return {
    id: bundle.relationship.id,
    relationship_type: bundle.relationship.relationshipType,
    from_entity_id: fromEntityId,
    to_entity_id: toEntityId,
    roles: {
      from: participantMap.get(fromEntityId) ?? "",
      to: participantMap.get(toEntityId) ?? ""
    },
    active: isActive,
    start: firstInterval?.validFrom ?? TIMELESS_RELATIONSHIP_START,
    end: hasTemporalIntervals ? (anyOpenEnded ? null : (endingTimes.at(-1) ?? null)) : null
  }
}

export function deriveFamilyNodes(edges: Edge[]): FamilyNode[] {
  const parentIdsByChildId = new Map<string, Set<string>>()

  for (const edge of edges) {
    if (!isParentChildRelationship(edge)) {
      continue
    }

    const fromRole = edge.roles.from.toLowerCase()
    const toRole = edge.roles.to.toLowerCase()

    const fromIsParent = fromRole === "parent"
    const toIsParent = toRole === "parent"
    const fromIsChild = fromRole === "child"
    const toIsChild = toRole === "child"

    let parentId: string | null = null
    let childId: string | null = null

    if (fromIsParent && toIsChild) {
      parentId = edge.from_entity_id
      childId = edge.to_entity_id
    } else if (toIsParent && fromIsChild) {
      parentId = edge.to_entity_id
      childId = edge.from_entity_id
    }

    if (!parentId || !childId) {
      continue
    }

    const parentIds = parentIdsByChildId.get(childId) ?? new Set<string>()
    parentIds.add(parentId)
    parentIdsByChildId.set(childId, parentIds)
  }

  const parentSetSignatures = new Set<string>()
  for (const parentIds of parentIdsByChildId.values()) {
    if (parentIds.size === 0) {
      continue
    }
    parentSetSignatures.add([...parentIds].sort().join("|"))
  }

  const familyNodes: FamilyNode[] = []
  for (const signature of [...parentSetSignatures].sort()) {
    const signatureHash = createHash("sha256").update(signature).digest("hex")
    familyNodes.push({
      id: `family:${signatureHash}`,
      entity_kind: "family"
    })
  }

  return familyNodes
}

function deriveFamilyGroups(edges: Edge[]): FamilyGroup[] {
  const parentIdsByChildId = new Map<string, Set<string>>()

  for (const edge of edges) {
    if (!isParentChildRelationship(edge)) {
      continue
    }

    const fromRole = edge.roles.from.toLowerCase()
    const toRole = edge.roles.to.toLowerCase()

    if (fromRole === "parent" && toRole === "child") {
      const parentIds = parentIdsByChildId.get(edge.to_entity_id) ?? new Set<string>()
      parentIds.add(edge.from_entity_id)
      parentIdsByChildId.set(edge.to_entity_id, parentIds)
      continue
    }

    if (toRole === "parent" && fromRole === "child") {
      const parentIds = parentIdsByChildId.get(edge.from_entity_id) ?? new Set<string>()
      parentIds.add(edge.to_entity_id)
      parentIdsByChildId.set(edge.from_entity_id, parentIds)
    }
  }

  const childIdsByParentSignature = new Map<string, Set<string>>()
  for (const [childId, parentIds] of parentIdsByChildId.entries()) {
    if (parentIds.size === 0) {
      continue
    }
    const signature = [...parentIds].sort().join("|")
    const childIds = childIdsByParentSignature.get(signature) ?? new Set<string>()
    childIds.add(childId)
    childIdsByParentSignature.set(signature, childIds)
  }

  const groups: FamilyGroup[] = []
  for (const signature of [...childIdsByParentSignature.keys()].sort()) {
    const hash = createHash("sha256").update(signature).digest("hex")
    groups.push({
      familyNode: {
        id: `family:${hash}`,
        entity_kind: "family"
      },
      parentIds: signature.split("|"),
      childIds: [...(childIdsByParentSignature.get(signature) ?? new Set<string>())].sort()
    })
  }

  return groups
}

export function toFamilyViewGraph(
  graph: GraphResponse,
  alreadyLoadedEntityIds: Set<string>,
  alreadyLoadedRelationshipIds: Set<string>
): GraphResponse {
  const groups = deriveFamilyGroups(graph.edges)

  const entities: Entity[] = [...graph.entities]
  const remainingEdges = graph.edges.filter(
    (edge) => !isParentChildRelationship(edge) && !isSiblingRelationship(edge)
  )
  const virtualEdges: Edge[] = []

  for (const group of groups) {
    if (!alreadyLoadedEntityIds.has(group.familyNode.id)) {
      entities.push({
        id: group.familyNode.id,
        entity_kind: "family",
        display_name: FAMILY_NODE_DISPLAY_NAME
      })
    }

    for (const parentId of group.parentIds) {
      const id = `family-parent:${parentId}:${group.familyNode.id}`
      if (alreadyLoadedRelationshipIds.has(id)) {
        continue
      }
      virtualEdges.push({
        id,
        relationship_type: "family_parent",
        from_entity_id: parentId,
        to_entity_id: group.familyNode.id,
        roles: {
          from: "parent",
          to: "family"
        },
        active: true,
        start: TIMELESS_RELATIONSHIP_START,
        end: null
      })
    }

    for (const childId of group.childIds) {
      const id = `family-child:${group.familyNode.id}:${childId}`
      if (alreadyLoadedRelationshipIds.has(id)) {
        continue
      }
      virtualEdges.push({
        id,
        relationship_type: "family_child",
        from_entity_id: group.familyNode.id,
        to_entity_id: childId,
        roles: {
          from: "family",
          to: "child"
        },
        active: true,
        start: TIMELESS_RELATIONSHIP_START,
        end: null
      })
    }
  }

  const dedupedEntities = [...new Map(entities.map((entity) => [entity.id, entity])).values()]
  const edges = [...new Map([...remainingEdges, ...virtualEdges].map((edge) => [edge.id, edge])).values()]

  return {
    entities: dedupedEntities,
    edges,
    meta: {
      ...graph.meta,
      node_count: dedupedEntities.length,
      edge_count: edges.length
    }
  }
}

async function fetchEntitiesByIds(graphId: string, ids: string[]): Promise<Map<string, EntityRow>> {
  if (ids.length === 0) {
    return new Map()
  }

  const db = getDb()
  const rows = await db
    .select({
      id: entity.id,
      entityKind: entity.entityKind,
      canonicalDisplayName: entity.canonicalDisplayName
    })
    .from(entity)
    .where(and(inArray(entity.id, ids), eq(entity.graphId, graphId)))

  return new Map(rows.map((row) => [row.id, row]))
}

async function fetchRelationshipBundles(
  graphId: string,
  relationshipIds: string[]
): Promise<RelationshipBundle[]> {
  if (relationshipIds.length === 0) {
    return []
  }

  const db = getDb()
  const relationshipRows = await db
    .select({
      id: relationship.id,
      relationshipType: relationshipType.code
    })
    .from(relationship)
    .innerJoin(relationshipType, eq(relationship.relationshipTypeId, relationshipType.id))
    .where(and(inArray(relationship.id, relationshipIds), eq(relationship.graphId, graphId)))

  const participantRows = await db
    .select({
      relationshipId: relationshipParticipant.relationshipId,
      entityId: relationshipParticipant.entityId,
      role: relationshipParticipant.roleInRelationship
    })
    .from(relationshipParticipant)
    .where(inArray(relationshipParticipant.relationshipId, relationshipIds))

  const intervalRows = await db
    .select({
      relationshipId: relationshipInterval.relationshipId,
      validFrom: relationshipInterval.validFrom,
      validTo: relationshipInterval.validTo
    })
    .from(relationshipInterval)
    .where(inArray(relationshipInterval.relationshipId, relationshipIds))

  const participantsByRelationship = new Map<string, RelationshipParticipantRow[]>()
  for (const participant of participantRows) {
    const rows = participantsByRelationship.get(participant.relationshipId) ?? []
    rows.push(participant)
    participantsByRelationship.set(participant.relationshipId, rows)
  }

  const intervalsByRelationship = new Map<string, RelationshipIntervalRow[]>()
  for (const interval of intervalRows) {
    const rows = intervalsByRelationship.get(interval.relationshipId) ?? []
    rows.push(interval)
    intervalsByRelationship.set(interval.relationshipId, rows)
  }

  return relationshipRows.map((relationshipRow) => ({
    relationship: relationshipRow,
    participants: participantsByRelationship.get(relationshipRow.id) ?? [],
    intervals: intervalsByRelationship.get(relationshipRow.id) ?? []
  }))
}

export async function buildGraphDeltaFromCenter(input: BuildGraphDeltaInput): Promise<GraphResponse | null> {
  const asOfTime = Date.parse(input.asOf)
  const db = getDb()

  const centerRows = await db
    .select({
      id: entity.id,
      entityKind: entity.entityKind,
      canonicalDisplayName: entity.canonicalDisplayName
    })
    .from(entity)
    .where(and(eq(entity.id, input.centerEntityId), eq(entity.graphId, input.graphId)))
    .limit(1)

  const center = centerRows[0]
  if (!center) {
    return null
  }

  if (input.allowedEntityKinds && !input.allowedEntityKinds.has(center.entityKind)) {
    return {
      entities: [],
      edges: [],
      meta: {
        truncated: false,
        node_count: 0,
        edge_count: 0
      }
    }
  }

  const resolvedEntities = new Map<string, Entity>([[center.id, toGraphEntity(center)]])
  const entityCache = new Map<string, EntityRow>([[center.id, center]])
  const resolvedEdges = new Map<string, Edge>()

  const visitedEntityIds = new Set<string>([center.id])
  const processedRelationshipIds = new Set<string>()
  let frontierEntityIds = new Set<string>([center.id])

  for (let hop = 0; hop < input.depth; hop += 1) {
    if (frontierEntityIds.size === 0) {
      break
    }

    const frontierList = [...frontierEntityIds]
    const relationshipIdRows = await db
      .select({ relationshipId: relationshipParticipant.relationshipId })
      .from(relationshipParticipant)
      .innerJoin(relationship, eq(relationshipParticipant.relationshipId, relationship.id))
      .where(
        and(inArray(relationshipParticipant.entityId, frontierList), eq(relationship.graphId, input.graphId))
      )

    const candidateRelationshipIds = [...new Set(relationshipIdRows.map((row) => row.relationshipId))].filter(
      (relationshipId) => !processedRelationshipIds.has(relationshipId)
    )

    if (candidateRelationshipIds.length === 0) {
      frontierEntityIds = new Set()
      continue
    }

    candidateRelationshipIds.forEach((relationshipId) => processedRelationshipIds.add(relationshipId))
    const bundles = await fetchRelationshipBundles(input.graphId, candidateRelationshipIds)

    const participantEntityIds = [
      ...new Set(bundles.flatMap((bundle) => bundle.participants.map((participant) => participant.entityId)))
    ]

    const missingEntityIds = participantEntityIds.filter((entityId) => !entityCache.has(entityId))
    if (missingEntityIds.length > 0) {
      const fetchedEntities = await fetchEntitiesByIds(input.graphId, missingEntityIds)
      fetchedEntities.forEach((row, id) => entityCache.set(id, row))
    }

    const nextFrontierIds = new Set<string>()
    for (const bundle of bundles) {
      const edge = resolveRelationshipEdge(
        bundle,
        asOfTime,
        entityCache,
        input.allowedEntityKinds,
        input.allowedRelationshipTypes,
        input.includeInactive
      )

      if (!edge) {
        continue
      }

      resolvedEdges.set(edge.id, edge)

      const fromInFrontier = frontierEntityIds.has(edge.from_entity_id)
      const toInFrontier = frontierEntityIds.has(edge.to_entity_id)
      if (fromInFrontier && !visitedEntityIds.has(edge.to_entity_id)) {
        visitedEntityIds.add(edge.to_entity_id)
        nextFrontierIds.add(edge.to_entity_id)
      }
      if (toInFrontier && !visitedEntityIds.has(edge.from_entity_id)) {
        visitedEntityIds.add(edge.from_entity_id)
        nextFrontierIds.add(edge.from_entity_id)
      }

      if (!resolvedEntities.has(edge.from_entity_id)) {
        const fromEntity = entityCache.get(edge.from_entity_id)
        if (fromEntity) {
          resolvedEntities.set(fromEntity.id, toGraphEntity(fromEntity))
        }
      }

      if (!resolvedEntities.has(edge.to_entity_id)) {
        const toEntity = entityCache.get(edge.to_entity_id)
        if (toEntity) {
          resolvedEntities.set(toEntity.id, toGraphEntity(toEntity))
        }
      }
    }

    frontierEntityIds = nextFrontierIds
  }

  const edges = [...resolvedEdges.values()].filter(
    (resolvedEdge) => !input.alreadyLoadedRelationshipIds.has(resolvedEdge.id)
  )

  const entities = [...resolvedEntities.values()].filter(
    (resolvedEntity) => !input.alreadyLoadedEntityIds.has(resolvedEntity.id)
  )

  return {
    entities,
    edges,
    meta: {
      truncated: false,
      node_count: entities.length,
      edge_count: edges.length
    }
  }
}
