import { describe, expect, it } from "vitest"

import { type GraphState } from "@/lib/api/graphState"
import {
  applyNodeClickToExpandedState,
  buildExplorerScopeKey,
  getScopedExpandedGraph,
  resolveVisibleGraphState,
  shouldExpandNode,
  type ExpandedGraphState
} from "@/lib/graph/explorerState"

const EMPTY_STATE: GraphState = { entities: {}, edges: {} }

function createScopeKey(centerEntityId: string): string {
  return buildExplorerScopeKey({
    graphId: "g1",
    activeCenterEntityId: centerEntityId,
    viewMode: "family",
    layoutMode: "family_tree",
    asOf: "2026-01-01T00:00:00.000Z",
    depth: 2,
    includeInactive: false
  })
}

describe("explorerState", () => {
  it("should_build_scope_key_with_view_mode", () => {
    const graphScope = buildExplorerScopeKey({
      graphId: "g1",
      activeCenterEntityId: "e1",
      viewMode: "graph",
      layoutMode: "graph",
      asOf: "2026-01-01T00:00:00.000Z",
      depth: 1,
      includeInactive: false
    })
    const familyScope = buildExplorerScopeKey({
      graphId: "g1",
      activeCenterEntityId: "e1",
      viewMode: "family",
      layoutMode: "family_tree",
      asOf: "2026-01-01T00:00:00.000Z",
      depth: 1,
      includeInactive: false
    })

    expect(graphScope).not.toBe(familyScope)
  })

  it("should_resolve_visible_graph_to_base_when_no_active_expansion_exists", () => {
    const scopeKey = createScopeKey("e1")
    const base: GraphState = {
      entities: { e1: { id: "e1", entity_kind: "person", display_name: "Alex" } },
      edges: {}
    }
    const expandedState: ExpandedGraphState = {
      scopeKey,
      activeEntityId: "e1",
      graphByEntityId: {}
    }

    expect(resolveVisibleGraphState(base, expandedState, scopeKey)).toEqual(base)
  })

  it("should_switch_to_active_expanded_graph_when_present", () => {
    const scopeKey = createScopeKey("e1")
    const base: GraphState = {
      entities: { e1: { id: "e1", entity_kind: "person", display_name: "Alex" } },
      edges: {}
    }
    const expandedGraph: GraphState = {
      entities: {
        e1: { id: "e1", entity_kind: "person", display_name: "Alex" },
        e2: { id: "e2", entity_kind: "person", display_name: "Blair" }
      },
      edges: {
        r1: {
          id: "r1",
          relationship_type: "romantic",
          from_entity_id: "e1",
          to_entity_id: "e2",
          roles: { from: "partner", to: "partner" },
          active: true,
          start: "2020-01-01T00:00:00.000Z",
          end: null
        }
      }
    }
    const expandedState: ExpandedGraphState = {
      scopeKey,
      activeEntityId: "e2",
      graphByEntityId: { e2: expandedGraph }
    }

    expect(getScopedExpandedGraph(expandedState, scopeKey)).toEqual(expandedGraph)
    expect(resolveVisibleGraphState(base, expandedState, scopeKey)).toEqual(expandedGraph)
  })

  it("should_replace_active_entity_on_click_and_preserve_scope_cache", () => {
    const scopeKey = createScopeKey("e1")
    const previous: ExpandedGraphState = {
      scopeKey,
      activeEntityId: "e1",
      graphByEntityId: { e1: EMPTY_STATE }
    }

    const next = applyNodeClickToExpandedState(previous, scopeKey, "e2")

    expect(next.scopeKey).toBe(scopeKey)
    expect(next.activeEntityId).toBe("e2")
    expect(next.graphByEntityId).toEqual(previous.graphByEntityId)
  })

  it("should_request_expand_only_when_target_node_cache_is_missing", () => {
    const scopeKey = createScopeKey("e1")
    const expandedState: ExpandedGraphState = {
      scopeKey,
      activeEntityId: "e1",
      graphByEntityId: { e1: EMPTY_STATE }
    }

    expect(shouldExpandNode(expandedState, scopeKey, "e1")).toBe(false)
    expect(shouldExpandNode(expandedState, scopeKey, "e2")).toBe(true)
    expect(shouldExpandNode(expandedState, `${scopeKey}|other`, "e1")).toBe(true)
  })
})
