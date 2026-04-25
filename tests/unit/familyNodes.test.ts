import { describe, expect, it } from "vitest"

import { toFamilyViewGraph } from "@/server/graph/projection"
import type { Edge, GraphResponse } from "@/types"

function createParentChildEdge(id: string, parentId: string, childId: string): Edge {
  return {
    id,
    relationship_type: "parent_child",
    from_entity_id: parentId,
    to_entity_id: childId,
    roles: { from: "parent", to: "child" },
    active: true,
    start: "2020-01-01T00:00:00.000Z",
    end: null
  }
}

describe("toFamilyViewGraph", () => {
  it("keeps parent_child edges and real entities", () => {
    const baseGraph: GraphResponse = {
      entities: [
        { id: "p1", entity_kind: "person", display_name: "Parent One" },
        { id: "p2", entity_kind: "person", display_name: "Parent Two" },
        { id: "c1", entity_kind: "person", display_name: "Child One" }
      ],
      edges: [
        createParentChildEdge("r1", "p1", "c1"),
        createParentChildEdge("r2", "p2", "c1")
      ],
      meta: { truncated: false, node_count: 3, edge_count: 2 }
    }

    const transformed = toFamilyViewGraph(baseGraph, new Set(), new Set())
    expect(transformed.entities).toEqual(baseGraph.entities)
    expect(transformed.edges).toEqual(baseGraph.edges)
    expect(transformed.meta.node_count).toBe(3)
    expect(transformed.meta.edge_count).toBe(2)
  })

  it("removes sibling edges and keeps other edge types", () => {
    const baseGraph: GraphResponse = {
      entities: [
        { id: "p1", entity_kind: "person", display_name: "Parent One" },
        { id: "p2", entity_kind: "person", display_name: "Parent Two" },
        { id: "c1", entity_kind: "person", display_name: "Child One" },
        { id: "c2", entity_kind: "person", display_name: "Child Two" }
      ],
      edges: [
        createParentChildEdge("r1", "p1", "c1"),
        createParentChildEdge("r2", "p1", "c2"),
        {
          id: "r3",
          relationship_type: "sibling",
          from_entity_id: "c1",
          to_entity_id: "c2",
          roles: { from: "sibling", to: "sibling" },
          active: true,
          start: "2020-01-01T00:00:00.000Z",
          end: null
        },
        {
          id: "r4",
          relationship_type: "romantic",
          from_entity_id: "p1",
          to_entity_id: "p2",
          roles: { from: "partner", to: "partner" },
          active: true,
          start: "2020-01-01T00:00:00.000Z",
          end: null
        }
      ],
      meta: { truncated: false, node_count: 4, edge_count: 4 }
    }

    const transformed = toFamilyViewGraph(baseGraph, new Set(), new Set())

    expect(transformed.edges.some((edge) => edge.relationship_type === "parent_child")).toBe(true)
    expect(transformed.edges.some((edge) => edge.relationship_type === "sibling")).toBe(false)
    expect(transformed.edges.some((edge) => edge.relationship_type === "romantic")).toBe(true)
  })

  it("removes legacy family_parent and family_child edges when present", () => {
    const baseGraph: GraphResponse = {
      entities: [
        { id: "p1", entity_kind: "person", display_name: "Parent One" },
        { id: "c1", entity_kind: "person", display_name: "Child One" }
      ],
      edges: [
        {
          id: "r1",
          relationship_type: "family_parent",
          from_entity_id: "p1",
          to_entity_id: "anchor:1",
          roles: { from: "parent", to: "family" },
          active: true,
          start: "2020-01-01T00:00:00.000Z",
          end: null
        },
        {
          id: "r2",
          relationship_type: "family_child",
          from_entity_id: "anchor:1",
          to_entity_id: "c1",
          roles: { from: "family", to: "child" },
          active: true,
          start: "2020-01-01T00:00:00.000Z",
          end: null
        },
        createParentChildEdge("r3", "p1", "c1")
      ],
      meta: { truncated: false, node_count: 2, edge_count: 3 }
    }

    const transformed = toFamilyViewGraph(baseGraph, new Set(), new Set())
    expect(transformed.edges.map((edge) => edge.id)).toEqual(["r3"])
    expect(transformed.meta.edge_count).toBe(1)
  })
})
