"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { fetchGraphExpand, fetchGraphView } from "@/lib/api/graph"
import type { Edge, Entity, GraphResponse } from "@/types"
import Badge from "@/components/ui/Badge"
import Card from "@/components/ui/Card"
import SectionHeader from "@/components/ui/SectionHeader"
import GraphCanvas from "./GraphCanvas"
import SidePanel from "./SidePanel"
import TimeSlider from "./TimeSlider"

type GraphExplorerProps = {
  graphId: string
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

export default function GraphExplorer({ graphId, entityId, initialAsOf }: GraphExplorerProps) {
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

  const scopeKey = `${graphId}|${entityId}|${uiState.asOf}|${uiState.depth}|${uiState.filters.entityTypes.join(",")}|${uiState.filters.relationshipTypes.join(",")}|${uiState.filters.includeInactive}`

  const viewQuery = useQuery({
    queryKey: [
      "graph:view",
      graphId,
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
        graph_id: graphId,
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
        graph_id: graphId,
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
    <section className="grid w-full gap-4 lg:grid-cols-[1fr_280px]">
      <section className="space-y-4">
        <Card as="header" className="fade-in p-4 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <SectionHeader className="text-[#6fe8ff]">Graph Explorer</SectionHeader>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge>Nodes: {entities.length}</Badge>
                <Badge>Edges: {edges.length}</Badge>
                <Badge variant={isLoading ? "accent" : "success"}>{isLoading ? "Syncing..." : "Synced"}</Badge>
              </div>
            </div>

            <div className="min-w-0 flex-1 lg:max-w-[420px]">
              <TimeSlider
                asOf={uiState.asOf}
                onChange={(nextAsOf) => {
                  setUiState((previous) => ({ ...previous, asOf: nextAsOf }))
                }}
              />
            </div>
          </div>
        </Card>

        {errorMessage ? (
          <Card variant="danger" className="p-3 text-sm">
            {errorMessage}
          </Card>
        ) : null}

        <Card className="p-3 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
          <GraphCanvas
            entities={entities}
            edges={edges}
            selectedEntityId={selectedEntityId}
            onNodeClick={(clickedEntityId) => {
              setSelectedEntityId(clickedEntityId)
              expandMutation.mutate(clickedEntityId)
            }}
          />
        </Card>
      </section>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <SidePanel
          selectedEntityId={selectedEntityId}
          nodeCount={entities.length}
          edgeCount={edges.length}
        />
      </div>
    </section>
  )
}
