"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { fetchGraphView } from "@/lib/api/graph"
import { EMPTY_GRAPH_STATE, toGraphState } from "@/lib/api/graphState"
import type { LayoutConfig, LayoutMode } from "@/lib/graph/layout"
import type { Edge } from "@/types"
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
  onNodeSelect?: (payload: { entityId: string; familySourceEntityIds?: string[] }) => void
  onEdgeSelect?: (edge: Edge | null) => void
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
  layoutConfig = { horizontalSpacing: 180, verticalSpacing: 180 },
  refreshKey = 0,
  selectedEntityId = null,
  showNodeLabels = false,
  showRelationshipLabels = false,
  onNodeSelect,
  onEdgeSelect
}: GraphExplorerProps) {
  const activeCenterEntityId = entityId

  const viewQuery = useQuery({
    queryKey: [
      "graph:view",
      graphId,
      activeCenterEntityId,
      viewMode,
      asOf,
      depth,
      includeInactive,
      refreshKey
    ],
    enabled: activeCenterEntityId.length > 0,
    queryFn: async () =>
      fetchGraphView({
        graph_id: graphId,
        center_entity_id: activeCenterEntityId,
        view_mode: viewMode,
        as_of: asOf,
        depth,
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
  })

  const baseGraph = useMemo(
    () => (viewQuery.data ? toGraphState(viewQuery.data) : EMPTY_GRAPH_STATE),
    [viewQuery.data]
  )
  const entities = useMemo(() => Object.values(baseGraph.entities), [baseGraph.entities])
  const edges = useMemo(() => Object.values(baseGraph.edges), [baseGraph.edges])
  const errorMessage = (viewQuery.error as Error | null)?.message ?? null

  return (
    <Stack className="relative h-full min-h-[520px] gap-0">
      <GraphCanvas
        entities={entities}
        edges={edges}
        layoutMode={layoutMode}
        layoutEngineMode={layoutEngineMode}
        layoutConfig={layoutConfig}
        selectedEntityId={selectedEntityId}
        showNodeLabels={showNodeLabels}
        showRelationshipLabels={showRelationshipLabels}
        onNodeClick={(clickedEntityId) => {
          if (clickedEntityId.startsWith("family:")) {
            const familySourceEntityIds = new Set<string>()
            for (const edge of Object.values(baseGraph.edges)) {
              if (edge.relationship_type === "family_parent" && edge.to_entity_id === clickedEntityId) {
                familySourceEntityIds.add(edge.from_entity_id)
              }
              if (edge.relationship_type === "family_child" && edge.from_entity_id === clickedEntityId) {
                familySourceEntityIds.add(edge.to_entity_id)
              }
            }
            onNodeSelect?.({
              entityId: clickedEntityId,
              familySourceEntityIds: [...familySourceEntityIds].sort()
            })
            return
          }
          onNodeSelect?.({ entityId: clickedEntityId })
        }}
        onEdgeClick={(clickedRelationshipId) => {
          onEdgeSelect?.(baseGraph.edges[clickedRelationshipId] ?? null)
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
