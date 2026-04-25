"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { fetchGraphView } from "@/lib/api/graph"
import { EMPTY_GRAPH_STATE, toGraphState } from "@/lib/api/graphState"
import type { LayoutConfig, LayoutMode } from "@/lib/graph/layout/types"
import { createDefaultLayoutConfig } from "@/lib/graph/layoutConfig"
import { computeVisibleSubgraph } from "@/lib/graph/visibility"
import type { Edge, GraphResponse } from "@/types"
import Card from "@/components/ui/Card"
import Stack from "@/components/ui/Stack"
import GraphCanvas from "./GraphCanvas"

type GraphExplorerProps = {
  graphId: string
  entityId: string
  viewMode?: "graph" | "family"
  asOf: string
  includeInactive: boolean
  depth?: number
  layoutMode?: "auto" | "manual"
  layoutEngineMode?: LayoutMode
  layoutConfig?: LayoutConfig
  refreshKey?: number
  selectedEntityId?: string | null
  showNodeLabels?: boolean
  showRelationshipLabels?: boolean
  onNodeSelect?: (payload: { entityId: string }) => void
  onEdgeSelect?: (edge: Edge | null) => void
}

function normalizeRelationshipType(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_")
}

function toClientFamilyViewGraph(graph: GraphResponse): GraphResponse {
  const edges = graph.edges.filter((edge) => {
    const relation = normalizeRelationshipType(edge.relationship_type)
    return relation !== "sibling" && relation !== "family_parent" && relation !== "family_child"
  })
  return {
    entities: graph.entities,
    edges,
    meta: {
      ...graph.meta,
      node_count: graph.entities.length,
      edge_count: edges.length
    }
  }
}

export default function GraphExplorer({
  graphId,
  entityId,
  viewMode = "graph",
  asOf,
  includeInactive,
  depth = 3,
  layoutMode = "auto",
  layoutEngineMode = "graph",
  layoutConfig = createDefaultLayoutConfig(),
  refreshKey = 0,
  selectedEntityId = null,
  showNodeLabels = false,
  showRelationshipLabels = false,
  onNodeSelect,
  onEdgeSelect
}: GraphExplorerProps) {
  const activeCenterEntityId = entityId
  const fetchDepth = 4

  const viewQuery = useQuery({
    queryKey: [
      "graph:view",
      graphId,
      activeCenterEntityId,
      viewMode,
      asOf,
      includeInactive,
      refreshKey
    ],
    enabled: activeCenterEntityId.length > 0,
    queryFn: async () => {
      const response = await fetchGraphView({
        graph_id: graphId,
        center_entity_id: activeCenterEntityId,
        view_mode: viewMode,
        as_of: asOf,
        depth: fetchDepth,
        filters: {
          entity_types: [],
          relationship_types: [],
          include_inactive: includeInactive
        },
        already_loaded: {
          entity_ids: [],
          relationship_ids: []
        }
      })
      if (viewMode !== "family" || response.entities.length > 0) {
        return response
      }

      const graphResponse = await fetchGraphView({
        graph_id: graphId,
        center_entity_id: activeCenterEntityId,
        view_mode: "graph",
        as_of: asOf,
        depth: fetchDepth,
        filters: {
          entity_types: [],
          relationship_types: [],
          include_inactive: includeInactive
        },
        already_loaded: {
          entity_ids: [],
          relationship_ids: []
        }
      })
      return toClientFamilyViewGraph(graphResponse)
    }
  })

  const baseGraph = useMemo(
    () => (viewQuery.data ? toGraphState(viewQuery.data) : EMPTY_GRAPH_STATE),
    [viewQuery.data]
  )
  const allEntities = useMemo(() => Object.values(baseGraph.entities), [baseGraph.entities])
  const allEdges = useMemo(() => Object.values(baseGraph.edges), [baseGraph.edges])
  const focusedNodeId = useMemo(() => {
    if (selectedEntityId && baseGraph.entities[selectedEntityId]) {
      return selectedEntityId
    }
    return activeCenterEntityId
  }, [selectedEntityId, baseGraph.entities, activeCenterEntityId])
  const visibleGraph = useMemo(
    () =>
      computeVisibleSubgraph({
        entities: allEntities,
        edges: allEdges,
        focusedNodeId,
        distance: depth
      }),
    [allEntities, allEdges, focusedNodeId, depth]
  )
  const errorMessage = (viewQuery.error as Error | null)?.message ?? null

  return (
    <Stack className="relative h-full min-h-[520px] gap-0">
      <GraphCanvas
        entities={visibleGraph.entities}
        edges={visibleGraph.edges}
        layoutMode={layoutMode}
        layoutEngineMode={layoutEngineMode}
        layoutConfig={layoutConfig}
        selectedEntityId={selectedEntityId}
        showNodeLabels={showNodeLabels}
        showRelationshipLabels={showRelationshipLabels}
        onNodeClick={(clickedEntityId) => {
          onNodeSelect?.({ entityId: clickedEntityId })
        }}
        onEdgeClick={(clickedRelationshipId) => {
          const selectedEdge = visibleGraph.edges.find((edge) => edge.id === clickedRelationshipId) ?? null
          onEdgeSelect?.(selectedEdge)
        }}
      />
      {errorMessage ? (
        <Stack className="pointer-events-none absolute bottom-3 right-3 gap-0">
          <Card variant="danger" className="px-2 py-1 text-xs">Error</Card>
        </Stack>
      ) : null}
    </Stack>
  )
}
