"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { fetchGraphExpand, fetchGraphView } from "@/lib/api/graph"
import { EMPTY_GRAPH_STATE, mergeGraphState, toGraphState, type GraphState } from "@/lib/api/graphState"
import type { Edge } from "@/types"
import Card from "@/components/ui/Card"
import GraphCanvas from "./GraphCanvas"

type GraphExplorerProps = {
  graphId: string
  entityId: string
  asOf: string
  includeInactive: boolean
  refreshKey?: number
  selectedEntityId?: string | null
  showNodeLabels?: boolean
  showRelationshipLabels?: boolean
  onNodeSelect?: (entityId: string) => void
  onEdgeSelect?: (edge: Edge | null) => void
  onAddLinkedNodeFrom?: (entityId: string) => void
}

const DEFAULT_DEPTH = 1

export default function GraphExplorer({
  graphId,
  entityId,
  asOf,
  includeInactive,
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

  const scopeKey = `${graphId}|${entityId}|${asOf}|${DEFAULT_DEPTH}|${includeInactive}|${refreshKey}`

  const viewQuery = useQuery({
    queryKey: [
      "graph:view",
      graphId,
      entityId,
      asOf,
      DEFAULT_DEPTH,
      includeInactive,
      refreshKey
    ],
    enabled: entityId.length > 0,
    queryFn: async () =>
      fetchGraphView({
        graph_id: graphId,
        center_entity_id: entityId,
        as_of: asOf,
        depth: DEFAULT_DEPTH,
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

  const scopedExpandedGraph =
    expandedState.scopeKey === scopeKey ? expandedState.graph : EMPTY_GRAPH_STATE
  const baseGraph = viewQuery.data ? toGraphState(viewQuery.data) : EMPTY_GRAPH_STATE
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
        depth: DEFAULT_DEPTH,
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
    <div className="relative h-full min-h-[520px]">
      <GraphCanvas
        entities={entities}
        edges={edges}
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
        <div className="pointer-events-none absolute bottom-3 right-3">
          <Card variant="danger" className="px-2 py-1 text-xs">Error</Card>
        </div>
      ) : null}
    </div>
  )
}
