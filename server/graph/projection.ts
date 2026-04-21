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

  const entities = [...resolvedEntities.values()].filter(
    (resolvedEntity) => !input.alreadyLoadedEntityIds.has(resolvedEntity.id)
  )
  const edges = [...resolvedEdges.values()].filter(
    (resolvedEdge) => !input.alreadyLoadedRelationshipIds.has(resolvedEdge.id)
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
