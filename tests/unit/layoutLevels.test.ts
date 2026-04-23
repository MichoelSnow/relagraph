import { describe, expect, it } from "vitest"

import { computeNodeLevels } from "@/lib/graph/layoutLevels"
import type { Edge, Entity } from "@/types"

function familyEdge(
  id: string,
  relationshipType: string,
  fromEntityId: string,
  toEntityId: string,
  fromRole: string,
  toRole: string
): Edge {
  return {
    id,
    relationship_type: relationshipType,
    from_entity_id: fromEntityId,
    to_entity_id: toEntityId,
    roles: { from: fromRole, to: toRole },
    active: true,
    start: "2020-01-01T00:00:00.000Z",
    end: null
  }
}

describe("computeNodeLevels", () => {
  it("should_place_family_node_between_parent_and_child_levels", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent One" },
      { id: "family:abc", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child One" }
    ]
    const edges: Edge[] = [
      familyEdge("e1", "family_parent", "p1", "family:abc", "parent", "family"),
      familyEdge("e2", "family_child", "family:abc", "c1", "family", "child")
    ]

    const levels = computeNodeLevels(entities, edges)

    expect(levels.get("p1")).toBe(0)
    expect(levels.get("family:abc")).toBe(1)
    expect(levels.get("c1")).toBe(2)
  })

  it("should_keep_sibling_nodes_on_same_level", () => {
    const entities: Entity[] = [
      { id: "c1", entity_kind: "person", display_name: "Child One" },
      { id: "c2", entity_kind: "person", display_name: "Child Two" }
    ]
    const edges: Edge[] = [familyEdge("e1", "sibling", "c1", "c2", "sibling", "sibling")]

    const levels = computeNodeLevels(entities, edges)

    expect(levels.get("c1")).toBe(levels.get("c2"))
  })

  it("should_support_role_based_parent_child_constraints_when_type_varies", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent One" },
      { id: "c1", entity_kind: "person", display_name: "Child One" }
    ]
    const edges: Edge[] = [familyEdge("e1", "unknown", "c1", "p1", "child", "parent")]

    const levels = computeNodeLevels(entities, edges)

    expect(levels.get("p1")).toBe(0)
    expect(levels.get("c1")).toBe(1)
  })
})
