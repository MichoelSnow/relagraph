import { describe, expect, it } from "vitest"

import { EMPTY_GRAPH_STATE, mergeGraphState, toGraphState } from "@/lib/api/graphState"
import type { GraphResponse } from "@/types"

const BASE_GRAPH: GraphResponse = {
  entities: [
    { id: "e1", entity_kind: "person", display_name: "Alex" },
    { id: "e2", entity_kind: "animal", display_name: "Maple" }
  ],
  edges: [
    {
      id: "r1",
      relationship_type: "owner",
      from_entity_id: "e1",
      to_entity_id: "e2",
      roles: { from: "owner", to: "pet" },
      active: true,
      start: "2020-01-01T00:00:00.000Z",
      end: null
    }
  ],
  meta: { truncated: false, node_count: 2, edge_count: 1 }
}

describe("toGraphState", () => {
  it("should_index_entities_and_edges_by_id_when_graph_response_is_valid", () => {
    const state = toGraphState(BASE_GRAPH)

    expect(Object.keys(state.entities)).toEqual(["e1", "e2"])
    expect(Object.keys(state.edges)).toEqual(["r1"])
    expect(state.entities.e1.display_name).toBe("Alex")
  })

  it("should_deduplicate_by_last_value_when_response_contains_duplicate_ids", () => {
    const duplicateResponse: GraphResponse = {
      ...BASE_GRAPH,
      entities: [
        { id: "e1", entity_kind: "person", display_name: "Old" },
        { id: "e1", entity_kind: "person", display_name: "New" }
      ],
      edges: [
        BASE_GRAPH.edges[0],
        {
          ...BASE_GRAPH.edges[0],
          id: "r1",
          relationship_type: "guardian"
        }
      ]
    }

    const state = toGraphState(duplicateResponse)

    expect(Object.keys(state.entities)).toEqual(["e1"])
    expect(state.entities.e1.display_name).toBe("New")
    expect(state.edges.r1.relationship_type).toBe("guardian")
  })
})

describe("mergeGraphState", () => {
  it("should_merge_without_mutating_previous_state_when_delta_has_new_records", () => {
    const previous = toGraphState(BASE_GRAPH)
    const delta = toGraphState({
      ...BASE_GRAPH,
      entities: [{ id: "e3", entity_kind: "place", display_name: "Home" }],
      edges: []
    })

    const merged = mergeGraphState(previous, delta)

    expect(Object.keys(previous.entities)).toEqual(["e1", "e2"])
    expect(Object.keys(merged.entities).sort()).toEqual(["e1", "e2", "e3"])
  })

  it("should_overwrite_existing_records_when_delta_contains_same_ids", () => {
    const previous = toGraphState(BASE_GRAPH)
    const delta = {
      entities: {
        e1: { ...previous.entities.e1, display_name: "Alex Updated" }
      },
      edges: {
        r1: { ...previous.edges.r1, active: false }
      }
    }

    const merged = mergeGraphState(previous, delta)

    expect(merged.entities.e1.display_name).toBe("Alex Updated")
    expect(merged.edges.r1.active).toBe(false)
  })

  it("should_return_previous_shape_when_delta_is_empty", () => {
    const previous = toGraphState(BASE_GRAPH)

    const merged = mergeGraphState(previous, EMPTY_GRAPH_STATE)

    expect(merged).toEqual(previous)
  })
})
