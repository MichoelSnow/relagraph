"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { fetchGraphExpand, fetchGraphView } from "@/lib/api/graph"
import { EMPTY_GRAPH_STATE, mergeGraphState, toGraphState, type GraphState } from "@/lib/api/graphState"
import type { Edge } from "@/types"
import Card from "@/components/ui/Card"
import Stack from "@/components/ui/Stack"
import GraphCanvas from "./GraphCanvas"

type GraphExplorerProps = {
  graphId: string
  entityId: string
  asOf: string
  includeInactive: boolean
  depth?: number
  layoutMode?: "auto" | "manual"
  refreshKey?: number
  selectedEntityId?: string | null
  showNodeLabels?: boolean
  showRelationshipLabels?: boolean
  onNodeSelect?: (entityId: string) => void
  onEdgeSelect?: (edge: Edge | null) => void
  onAddLinkedNodeFrom?: (entityId: string) => void
}

export default function GraphExplorer({
  graphId,
  entityId,
  asOf,
  includeInactive,
  depth = 3,
  layoutMode = "auto",
  refreshKey = 0,
  selectedEntityId = null,
  showNodeLabels = false,
  showRelationshipLabels = false,
  onNodeSelect,
  onEdgeSelect,
  onAddLinkedNodeFrom
}: GraphExplorerProps) {
  const [expandedState, setExpandedState] = useState<{
    scopeKey: string
    graph: GraphState
  }>({
    scopeKey: "",
    graph: EMPTY_GRAPH_STATE
  })

  const scopeKey = `${graphId}|${entityId}|${asOf}|${depth}|${includeInactive}`

  const viewQuery = useQuery({
    queryKey: [
      "graph:view",
      graphId,
      entityId,
      asOf,
      depth,
      includeInactive,
      refreshKey
    ],
    enabled: entityId.length > 0,
    queryFn: async () =>
      fetchGraphView({
        graph_id: graphId,
        center_entity_id: entityId,
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

  const scopedExpandedGraph = useMemo(
    () => (expandedState.scopeKey === scopeKey ? expandedState.graph : EMPTY_GRAPH_STATE),
    [expandedState, scopeKey]
  )
  const baseGraph = useMemo(
    () => (viewQuery.data ? toGraphState(viewQuery.data) : EMPTY_GRAPH_STATE),
    [viewQuery.data]
  )
  const graphState = useMemo(
    () => mergeGraphState(baseGraph, scopedExpandedGraph),
    [baseGraph, scopedExpandedGraph]
  )

  const expandMutation = useMutation({
    mutationFn: async (targetEntityId: string) =>
      fetchGraphExpand({
        graph_id: graphId,
        entity_id: targetEntityId,
        as_of: asOf,
        depth,
        filters: {
          entity_types: [],
          relationship_types: [],
          include_inactive: includeInactive
        },
        already_loaded: {
          entity_ids: Object.keys(graphState.entities),
          relationship_ids: Object.keys(graphState.edges)
        }
      }),
    onSuccess: (delta) => {
      setExpandedState((previous) => {
        const previousGraph = previous.scopeKey === scopeKey ? previous.graph : EMPTY_GRAPH_STATE
        const deltaGraph = toGraphState(delta)

        return {
          scopeKey,
          graph: mergeGraphState(previousGraph, deltaGraph)
        }
      })
    }
  })

  const entities = useMemo(() => Object.values(graphState.entities), [graphState.entities])
  const edges = useMemo(() => Object.values(graphState.edges), [graphState.edges])
  const errorMessage =
    (viewQuery.error as Error | null)?.message ??
    (expandMutation.error as Error | null)?.message ??
    null

  return (
    <Stack className="relative h-full min-h-[520px] gap-0">
      <GraphCanvas
        entities={entities}
        edges={edges}
        layoutMode={layoutMode}
        selectedEntityId={selectedEntityId}
        showNodeLabels={showNodeLabels}
        showRelationshipLabels={showRelationshipLabels}
        onNodeClick={(clickedEntityId) => {
          onNodeSelect?.(clickedEntityId)
          expandMutation.mutate(clickedEntityId)
        }}
        onEdgeClick={(clickedRelationshipId) => {
          onEdgeSelect?.(graphState.edges[clickedRelationshipId] ?? null)
        }}
        onAddLinkedNodeFrom={onAddLinkedNodeFrom}
      />
      {errorMessage ? (
        <Stack className="pointer-events-none absolute bottom-3 right-3 gap-0">
          <Card variant="danger" className="px-2 py-1 text-xs">Error</Card>
        </Stack>
      ) : null}
    </Stack>
  )
}
