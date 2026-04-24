import { EMPTY_GRAPH_STATE, type GraphState } from "@/lib/api/graphState"

export type ExpandedGraphState = {
  scopeKey: string
  activeEntityId: string | null
  graphByEntityId: Record<string, GraphState>
}

type ScopeKeyInput = {
  graphId: string
  activeCenterEntityId: string
  viewMode: "graph" | "family"
  layoutMode: "graph" | "family_tree"
  asOf: string
  depth: number
  includeInactive: boolean
}

export function buildExplorerScopeKey(input: ScopeKeyInput): string {
  return `${input.graphId}|${input.activeCenterEntityId}|${input.viewMode}|${input.layoutMode}|${input.asOf}|${input.depth}|${input.includeInactive}`
}

export function getScopedExpandedGraph(
  expandedState: ExpandedGraphState,
  scopeKey: string
): GraphState {
  if (expandedState.scopeKey !== scopeKey) {
    return EMPTY_GRAPH_STATE
  }
  const activeEntityId = expandedState.activeEntityId
  if (!activeEntityId) {
    return EMPTY_GRAPH_STATE
  }
  return expandedState.graphByEntityId[activeEntityId] ?? EMPTY_GRAPH_STATE
}

export function resolveVisibleGraphState(
  baseGraph: GraphState,
  expandedState: ExpandedGraphState,
  scopeKey: string
): GraphState {
  const scopedExpandedGraph = getScopedExpandedGraph(expandedState, scopeKey)
  const hasActiveExpansion =
    expandedState.scopeKey === scopeKey &&
    expandedState.activeEntityId !== null &&
    expandedState.graphByEntityId[expandedState.activeEntityId] !== undefined
  if (hasActiveExpansion) {
    return scopedExpandedGraph
  }
  return baseGraph
}

export function shouldExpandNode(
  expandedState: ExpandedGraphState,
  scopeKey: string,
  entityId: string
): boolean {
  if (expandedState.scopeKey !== scopeKey) {
    return true
  }
  return expandedState.graphByEntityId[entityId] === undefined
}

export function applyNodeClickToExpandedState(
  previous: ExpandedGraphState,
  scopeKey: string,
  entityId: string
): ExpandedGraphState {
  return {
    scopeKey,
    activeEntityId: entityId,
    graphByEntityId: previous.scopeKey === scopeKey ? previous.graphByEntityId : {}
  }
}
