"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { fetchGraphExpand, fetchGraphView } from "@/lib/api/graph"
import type { Edge, Entity, GraphResponse } from "@/types"
import Badge from "@/components/ui/Badge"
import PageHeader from "@/components/ui/PageHeader"
import PageLayout from "@/components/ui/PageLayout"
import Section from "@/components/ui/Section"
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
    <PageLayout className="space-y-4">
      <PageHeader
        title="Graph Explorer"
        description="Navigate relationships and expand from selected nodes."
      />

      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Nodes: {entities.length}</Badge>
          <Badge>Edges: {edges.length}</Badge>
          <Badge variant={isLoading ? "accent" : "success"}>{isLoading ? "Syncing..." : "Synced"}</Badge>
          <div className="w-full max-w-[360px]">
            <TimeSlider
              asOf={uiState.asOf}
              onChange={(nextAsOf) => {
                setUiState((previous) => ({ ...previous, asOf: nextAsOf }))
              }}
            />
          </div>
        </div>
      </Section>

      <Section title="Canvas">
        {errorMessage ? <p className="mb-3 text-sm text-[var(--console-danger-text)]">{errorMessage}</p> : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <GraphCanvas
            entities={entities}
            edges={edges}
            selectedEntityId={selectedEntityId}
            onNodeClick={(clickedEntityId) => {
              setSelectedEntityId(clickedEntityId)
              expandMutation.mutate(clickedEntityId)
            }}
          />
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <SidePanel
              selectedEntityId={selectedEntityId}
              nodeCount={entities.length}
              edgeCount={edges.length}
            />
          </aside>
        </div>
      </Section>
    </PageLayout>
  )
}
