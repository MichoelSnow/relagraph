import {
  inferDependentEdgeDirection,
  isFamilyChildRelationshipType,
  isFamilyParentRelationshipType,
  isParentChildRelationshipType,
  isRomanticRelationshipType
} from "@/lib/graph/semantics/relationshipSemantics"
import type { FamilyTreeStructure } from "@/lib/graph/layout/steps/buildStructure"

import type { LayoutStage } from "@/lib/graph/layout/pipeline"
import type { Edge, Entity } from "@/types"

type FamilyLayoutLike = {
  nodes: { id: string; x: number; y: number }[]
  edges: { id: string; path?: unknown }[]
  anchorPositionsById?: Record<string, { x: number; y: number }>
  nodePositionsById?: Record<string, { x: number; y: number }>
}

type OrderedFamilyData = {
  parentByDependentId?: Map<string, string>
}

function existingRouteEdgesLogic(
  entities: Entity[],
  edges: Edge[],
  layout: FamilyLayoutLike | undefined,
  structure: FamilyTreeStructure | undefined,
  ordered: OrderedFamilyData | undefined
) {
  const nodePositionsById = new Map<string, { x: number; y: number }>(
    Object.entries(layout?.nodePositionsById ?? {})
  )
  const anchorPositionsById = new Map<string, { x: number; y: number }>(
    Object.entries(layout?.anchorPositionsById ?? {})
  )
  const parentByDependentId = ordered?.parentByDependentId ?? structure?.parentByDependentId ?? new Map()

  return edges.map((edge) => {
    const fromPosition = nodePositionsById.get(edge.from_entity_id)
    const toPosition = nodePositionsById.get(edge.to_entity_id)
    const midpointY =
      fromPosition && toPosition ? (fromPosition.y + toPosition.y) / 2 : fromPosition?.y ?? toPosition?.y ?? 0

    if (isRomanticRelationshipType(edge.relationship_type)) {
      return {
        id: edge.id,
        path: {
          kind: "orthogonal_horizontal",
          connectorY: fromPosition?.y ?? midpointY
        }
      }
    }

    if (isFamilyParentRelationshipType(edge.relationship_type)) {
      const anchor = anchorPositionsById.get(edge.to_entity_id)
      return {
        id: edge.id,
        path: {
          kind: "orthogonal",
          connectorY: anchor?.y ?? midpointY
        }
      }
    }

    if (isFamilyChildRelationshipType(edge.relationship_type)) {
      const anchor = anchorPositionsById.get(edge.from_entity_id)
      return {
        id: edge.id,
        path: {
          kind: "orthogonal",
          connectorY: anchor?.y ?? midpointY
        }
      }
    }

    const parentChildDirection =
      isParentChildRelationshipType(edge.relationship_type) ? inferDependentEdgeDirection(edge) : null
    if (parentChildDirection) {
      const anchorId = parentByDependentId.get(parentChildDirection.dependentId)
      const anchor = anchorId ? anchorPositionsById.get(anchorId) : undefined
      return {
        id: edge.id,
        path: {
          kind: "orthogonal",
          connectorY: anchor?.y ?? midpointY
        }
      }
    }

    return {
      id: edge.id,
      path: {
        kind: "orthogonal",
        connectorY: midpointY
      }
    }
  })
}

export const routeEdges: LayoutStage = (ctx) => {
  const { entities, edges, layout, structure, ordered } = ctx

  const routedEdges = existingRouteEdgesLogic(
    entities,
    edges,
    layout as FamilyLayoutLike | undefined,
    structure as FamilyTreeStructure | undefined,
    ordered as OrderedFamilyData | undefined
  )

  return {
    ...ctx,
    routedEdges
  }
}
