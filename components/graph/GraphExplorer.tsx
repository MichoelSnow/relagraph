"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { fetchGraphExpand, fetchGraphView } from "@/lib/api/graph"
import { EMPTY_GRAPH_STATE, toGraphState, type GraphState } from "@/lib/api/graphState"
import {
  applyNodeClickToExpandedState,
  buildExplorerScopeKey,
  resolveVisibleGraphState,
  shouldExpandNode
} from "@/lib/graph/explorerState"
import type { LayoutConfig, LayoutMode } from "@/lib/graph/layout"
import type { Edge, Entity } from "@/types"
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
  onNodeSelect?: (entityId: string) => void
  onEdgeSelect?: (edge: Edge | null) => void
  onAddLinkedNodeFrom?: (payload: {
    entityId: string
    entityKind: Entity["entity_kind"]
    familyParentIds?: string[]
    familyChildIds?: string[]
  }) => void
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
  onEdgeSelect,
  onAddLinkedNodeFrom
}: GraphExplorerProps) {
  const activeCenterEntityId = entityId

  const [expandedState, setExpandedState] = useState<{
    scopeKey: string
    activeEntityId: string | null
    graphByEntityId: Record<string, GraphState>
  }>({
    scopeKey: "",
    activeEntityId: null,
    graphByEntityId: {}
  })

  const scopeKey = buildExplorerScopeKey({
    graphId,
    activeCenterEntityId,
    viewMode,
    layoutMode: layoutEngineMode,
    asOf,
    depth,
    includeInactive
  })

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
  const graphState = useMemo(
    () => resolveVisibleGraphState(baseGraph, expandedState, scopeKey),
    [baseGraph, expandedState, scopeKey]
  )

  const expandMutation = useMutation({
    mutationFn: async (targetEntityId: string) =>
      fetchGraphExpand({
        graph_id: graphId,
        entity_id: targetEntityId,
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
      }),
    onSuccess: (delta, targetEntityId) => {
      const deltaGraph = toGraphState(delta)
      setExpandedState((previous) => {
        const previousGraphByEntityId =
          previous.scopeKey === scopeKey ? previous.graphByEntityId : {}

        return {
          scopeKey,
          activeEntityId: targetEntityId,
          graphByEntityId: {
            ...previousGraphByEntityId,
            [targetEntityId]: deltaGraph
          }
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
        layoutEngineMode={layoutEngineMode}
        layoutConfig={layoutConfig}
        selectedEntityId={selectedEntityId}
        showNodeLabels={showNodeLabels}
        showRelationshipLabels={showRelationshipLabels}
        onNodeClick={(clickedEntityId) => {
          onNodeSelect?.(clickedEntityId)
          const needsExpand = shouldExpandNode(expandedState, scopeKey, clickedEntityId)
          setExpandedState((previous) =>
            applyNodeClickToExpandedState(previous, scopeKey, clickedEntityId)
          )

          if (needsExpand) {
            expandMutation.mutate(clickedEntityId)
          }
        }}
        onEdgeClick={(clickedRelationshipId) => {
          onEdgeSelect?.(graphState.edges[clickedRelationshipId] ?? null)
        }}
        onAddLinkedNodeFrom={(node) => {
          if (!onAddLinkedNodeFrom) {
            return
          }

          if (node.entityKind !== "family") {
            onAddLinkedNodeFrom({
              entityId: node.entityId,
              entityKind: node.entityKind
            })
            return
          }

          const familyParentIds = new Set<string>()
          const familyChildIds = new Set<string>()
          for (const edge of Object.values(graphState.edges)) {
            if (edge.relationship_type === "family_parent" && edge.to_entity_id === node.entityId) {
              familyParentIds.add(edge.from_entity_id)
            }
            if (edge.relationship_type === "family_child" && edge.from_entity_id === node.entityId) {
              familyChildIds.add(edge.to_entity_id)
            }
          }

          onAddLinkedNodeFrom({
            entityId: node.entityId,
            entityKind: node.entityKind,
            familyParentIds: [...familyParentIds].sort(),
            familyChildIds: [...familyChildIds].sort()
          })
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
