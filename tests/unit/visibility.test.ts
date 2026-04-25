import { describe, expect, it } from "vitest"

import { computeVisibleSubgraph } from "@/lib/graph/visibility"
import type { Edge, Entity } from "@/types"

describe("computeVisibleSubgraph", () => {
  it("treats family connector as zero-cost for hop counting", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child" }
    ]
    const edges: Edge[] = [
      {
        id: "e1",
        relationship_type: "family_parent",
        from_entity_id: "p1",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e2",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const visible = computeVisibleSubgraph({ entities, edges, focusedNodeId: "p1", distance: 1 })
    expect(visible.entities.map((entity) => entity.id)).toEqual(["p1", "f1", "c1"])
    expect(visible.edges.map((edge) => edge.id)).toEqual(["e1", "e2"])
  })

  it("returns nodes within BFS distance from focus", () => {
    const entities: Entity[] = [
      { id: "a", entity_kind: "person", display_name: "A" },
      { id: "b", entity_kind: "person", display_name: "B" },
      { id: "c", entity_kind: "person", display_name: "C" },
      { id: "d", entity_kind: "person", display_name: "D" }
    ]
    const edges: Edge[] = [
      {
        id: "e1",
        relationship_type: "parent_child",
        from_entity_id: "a",
        to_entity_id: "b",
        roles: { from: "parent", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e2",
        relationship_type: "parent_child",
        from_entity_id: "b",
        to_entity_id: "c",
        roles: { from: "parent", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "parent_child",
        from_entity_id: "c",
        to_entity_id: "d",
        roles: { from: "parent", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const visible = computeVisibleSubgraph({ entities, edges, focusedNodeId: "b", distance: 1 })

    expect(visible.entities.map((entity) => entity.id)).toEqual(["a", "b", "c"])
    expect(visible.edges.map((edge) => edge.id)).toEqual(["e1", "e2"])
  })

  it("always includes romantic partners of included nodes", () => {
    const entities: Entity[] = [
      { id: "a", entity_kind: "person", display_name: "A" },
      { id: "b", entity_kind: "person", display_name: "B" },
      { id: "r", entity_kind: "person", display_name: "R" }
    ]
    const edges: Edge[] = [
      {
        id: "e1",
        relationship_type: "parent_child",
        from_entity_id: "a",
        to_entity_id: "b",
        roles: { from: "parent", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e2",
        relationship_type: "romantic",
        from_entity_id: "b",
        to_entity_id: "r",
        roles: { from: "partner", to: "partner" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const visible = computeVisibleSubgraph({ entities, edges, focusedNodeId: "a", distance: 1 })

    expect(visible.entities.map((entity) => entity.id)).toEqual(["a", "b", "r"])
    expect(visible.edges.map((edge) => edge.id)).toEqual(["e1", "e2"])
  })

  it("includes family nodes when linked parent/child nodes are included", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child" }
    ]
    const edges: Edge[] = [
      {
        id: "e1",
        relationship_type: "family_parent",
        from_entity_id: "p1",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e2",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const visible = computeVisibleSubgraph({ entities, edges, focusedNodeId: "c1", distance: 0 })

    expect(visible.entities.map((entity) => entity.id)).toEqual(["f1", "c1"])
    expect(visible.edges.map((edge) => edge.id)).toEqual(["e2"])
  })
})
