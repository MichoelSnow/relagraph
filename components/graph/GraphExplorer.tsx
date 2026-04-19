"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { fetchGraphExpand, fetchGraphView } from "@/lib/api/graph"
import type { Edge, Entity, GraphResponse } from "@/types"
import GraphCanvas from "./GraphCanvas"
import SidePanel from "./SidePanel"
import TimeSlider from "./TimeSlider"

type GraphExplorerProps = {
  entityId: string
  initialAsOf: string
}

type GraphState = {
  entities: Record<string, Entity>
  edges: Record<string, Edge>
}

type GraphUiState = {
  asOf: string
  depth: number
  filters: {
    entityTypes: string[]
    relationshipTypes: string[]
    includeInactive: boolean
  }
}

const EMPTY_GRAPH_STATE: GraphState = { entities: {}, edges: {} }

function toGraphState(delta: GraphResponse): GraphState {
  return {
    entities: Object.fromEntries(delta.entities.map((entity) => [entity.id, entity])),
    edges: Object.fromEntries(delta.edges.map((edge) => [edge.id, edge]))
  }
}

function mergeGraphState(previous: GraphState, delta: GraphState): GraphState {
  const nextEntities = { ...previous.entities }
  for (const entity of Object.values(delta.entities)) {
    nextEntities[entity.id] = entity
  }

  const nextEdges = { ...previous.edges }
  for (const edge of Object.values(delta.edges)) {
    nextEdges[edge.id] = edge
  }

  return {
    entities: nextEntities,
    edges: nextEdges
  }
}

export default function GraphExplorer({ entityId, initialAsOf }: GraphExplorerProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [expandedState, setExpandedState] = useState<{
    scopeKey: string
    graph: GraphState
  }>({
    scopeKey: "",
    graph: EMPTY_GRAPH_STATE
  })
  const [uiState, setUiState] = useState<GraphUiState>({
    asOf: initialAsOf,
    depth: 1,
    filters: {
      entityTypes: [],
      relationshipTypes: [],
      includeInactive: false
    }
  })

  const scopeKey = `${entityId}|${uiState.asOf}|${uiState.depth}|${uiState.filters.entityTypes.join(",")}|${uiState.filters.relationshipTypes.join(",")}|${uiState.filters.includeInactive}`

  const viewQuery = useQuery({
    queryKey: [
      "graph:view",
      entityId,
      uiState.asOf,
      uiState.depth,
      uiState.filters.entityTypes.join(","),
      uiState.filters.relationshipTypes.join(","),
      uiState.filters.includeInactive
    ],
    enabled: entityId.length > 0,
    queryFn: async () =>
      fetchGraphView({
        center_entity_id: entityId,
        as_of: uiState.asOf,
        depth: uiState.depth,
        filters: {
          entity_types: uiState.filters.entityTypes,
          relationship_types: uiState.filters.relationshipTypes,
          include_inactive: uiState.filters.includeInactive
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
        entity_id: targetEntityId,
        as_of: uiState.asOf,
        depth: uiState.depth,
        filters: {
          entity_types: uiState.filters.entityTypes,
          relationship_types: uiState.filters.relationshipTypes,
          include_inactive: uiState.filters.includeInactive
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

  const isLoading = viewQuery.isLoading || expandMutation.isPending
  const errorMessage =
    (viewQuery.error as Error | null)?.message ??
    (expandMutation.error as Error | null)?.message ??
    null

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_280px]">
      <section className="space-y-4">
        <header className="rounded-md border border-slate-300 bg-white p-3">
          <h1 className="text-base font-semibold text-slate-900">Graph Explorer</h1>
          <p className="mt-1 text-sm text-slate-600">Center entity: {entityId}</p>
        </header>

        <TimeSlider
          asOf={uiState.asOf}
          onChange={(nextAsOf) => {
            setUiState((previous) => ({ ...previous, asOf: nextAsOf }))
          }}
        />

        {errorMessage ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <GraphCanvas
          entities={entities}
          edges={edges}
          onNodeClick={(clickedEntityId) => {
            setSelectedEntityId(clickedEntityId)
            expandMutation.mutate(clickedEntityId)
          }}
        />

        <p className="text-xs text-slate-600">
          {isLoading ? "Loading graph..." : `Loaded ${entities.length} nodes and ${edges.length} edges.`}
        </p>
      </section>

      <SidePanel
        selectedEntityId={selectedEntityId}
        nodeCount={entities.length}
        edgeCount={edges.length}
      />
    </main>
  )
}
