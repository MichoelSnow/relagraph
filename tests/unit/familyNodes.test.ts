import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import { deriveFamilyNodes, toFamilyViewGraph } from "@/server/graph/projection"
import type { Edge, GraphResponse } from "@/types"

function familyIdForParents(parentIds: string[]): string {
  const signature = [...parentIds].sort().join("|")
  return `family:${createHash("sha256").update(signature).digest("hex")}`
}

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

describe("deriveFamilyNodes", () => {
  it("should_generate_family_nodes_for_single_two_and_multi_parent_sets", () => {
    const edges: Edge[] = [
      createParentChildEdge("r1", "p1", "c1"),
      createParentChildEdge("r2", "p1", "c2"),
      createParentChildEdge("r3", "p2", "c2"),
      createParentChildEdge("r4", "p1", "c3"),
      createParentChildEdge("r5", "p2", "c3"),
      createParentChildEdge("r6", "p3", "c3")
    ]

    const result = deriveFamilyNodes(edges)

    expect(result).toEqual([
      { id: familyIdForParents(["p1"]), entity_kind: "family" },
      { id: familyIdForParents(["p1", "p2"]), entity_kind: "family" },
      { id: familyIdForParents(["p1", "p2", "p3"]), entity_kind: "family" }
    ])
  })

  it("should_be_deterministic_regardless_of_edge_input_order", () => {
    const ordered: Edge[] = [
      createParentChildEdge("r1", "p1", "c1"),
      createParentChildEdge("r2", "p2", "c1"),
      createParentChildEdge("r3", "p3", "c2")
    ]
    const reversed = [...ordered].reverse()

    expect(deriveFamilyNodes(ordered)).toEqual(deriveFamilyNodes(reversed))
  })

  it("should_ignore_non_parent_child_relationships", () => {
    const result = deriveFamilyNodes([
      {
        id: "r1",
        relationship_type: "romantic",
        from_entity_id: "e1",
        to_entity_id: "e2",
        roles: { from: "partner", to: "partner" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      }
    ])

    expect(result).toEqual([])
  })
})

describe("toFamilyViewGraph", () => {
  it("should_replace_parent_child_edges_with_family_structure", () => {
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
      meta: {
        truncated: false,
        node_count: 3,
        edge_count: 2
      }
    }

    const transformed = toFamilyViewGraph(baseGraph, new Set(), new Set())
    const familyId = familyIdForParents(["p1", "p2"])

    expect(transformed).toEqual({
      entities: [
        { id: "p1", entity_kind: "person", display_name: "Parent One" },
        { id: "p2", entity_kind: "person", display_name: "Parent Two" },
        { id: "c1", entity_kind: "person", display_name: "Child One" },
        { id: familyId, entity_kind: "family", display_name: "Family" }
      ],
      edges: [
        {
          id: `family-parent:p1:${familyId}`,
          relationship_type: "family_parent",
          from_entity_id: "p1",
          to_entity_id: familyId,
          roles: { from: "parent", to: "family" },
          active: true,
          start: "1900-01-01T00:00:00.000Z",
          end: null
        },
        {
          id: `family-parent:p2:${familyId}`,
          relationship_type: "family_parent",
          from_entity_id: "p2",
          to_entity_id: familyId,
          roles: { from: "parent", to: "family" },
          active: true,
          start: "1900-01-01T00:00:00.000Z",
          end: null
        },
        {
          id: `family-child:${familyId}:c1`,
          relationship_type: "family_child",
          from_entity_id: familyId,
          to_entity_id: "c1",
          roles: { from: "family", to: "child" },
          active: true,
          start: "1900-01-01T00:00:00.000Z",
          end: null
        }
      ],
      meta: {
        truncated: false,
        node_count: 4,
        edge_count: 3
      }
    })
  })

  it("should_return_input_graph_when_no_parent_child_edges_exist", () => {
    const baseGraph: GraphResponse = {
      entities: [{ id: "e1", entity_kind: "person", display_name: "Alex" }],
      edges: [
        {
          id: "r1",
          relationship_type: "romantic",
          from_entity_id: "e1",
          to_entity_id: "e2",
          roles: { from: "partner", to: "partner" },
          active: true,
          start: "2020-01-01T00:00:00.000Z",
          end: null
        }
      ],
      meta: { truncated: false, node_count: 1, edge_count: 1 }
    }

    expect(toFamilyViewGraph(baseGraph, new Set(), new Set())).toEqual(baseGraph)
  })

  it("should_remove_parent_child_edges_even_when_roles_do_not_match_parent_child", () => {
    const baseGraph: GraphResponse = {
      entities: [
        { id: "p1", entity_kind: "person", display_name: "Parent One" },
        { id: "c1", entity_kind: "person", display_name: "Child One" },
        { id: "x1", entity_kind: "person", display_name: "Other One" }
      ],
      edges: [
        createParentChildEdge("r1", "p1", "c1"),
        {
          id: "r2",
          relationship_type: "parent_child",
          from_entity_id: "p1",
          to_entity_id: "x1",
          roles: { from: "guardian", to: "ward" },
          active: true,
          start: "2020-01-01T00:00:00.000Z",
          end: null
        }
      ],
      meta: { truncated: false, node_count: 3, edge_count: 2 }
    }

    const transformed = toFamilyViewGraph(baseGraph, new Set(), new Set())

    expect(transformed.edges.some((edge) => edge.id === "r1")).toBe(false)
    expect(transformed.edges.some((edge) => edge.id === "r2")).toBe(false)
    expect(transformed.edges.some((edge) => edge.relationship_type === "family_parent")).toBe(true)
    expect(transformed.edges.some((edge) => edge.relationship_type === "family_child")).toBe(true)
  })

  it("should_remove_sibling_edges_and_keep_other_edge_types", () => {
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

    expect(transformed.edges.some((edge) => edge.relationship_type === "parent_child")).toBe(false)
    expect(transformed.edges.some((edge) => edge.relationship_type === "sibling")).toBe(false)
    expect(transformed.edges.some((edge) => edge.relationship_type === "romantic")).toBe(true)
    expect(transformed.edges.some((edge) => edge.relationship_type === "family_parent")).toBe(true)
    expect(transformed.edges.some((edge) => edge.relationship_type === "family_child")).toBe(true)
  })

  it("should_remove_sibling_edges_even_when_no_family_groups_are_derived", () => {
    const baseGraph: GraphResponse = {
      entities: [
        { id: "c1", entity_kind: "person", display_name: "Child One" },
        { id: "c2", entity_kind: "person", display_name: "Child Two" }
      ],
      edges: [
        {
          id: "r1",
          relationship_type: "sibling",
          from_entity_id: "c1",
          to_entity_id: "c2",
          roles: { from: "sibling", to: "sibling" },
          active: true,
          start: "2020-01-01T00:00:00.000Z",
          end: null
        }
      ],
      meta: { truncated: false, node_count: 2, edge_count: 1 }
    }

    const transformed = toFamilyViewGraph(baseGraph, new Set(), new Set())

    expect(transformed.entities).toEqual(baseGraph.entities)
    expect(transformed.edges).toEqual([])
    expect(transformed.meta.edge_count).toBe(0)
  })
})
