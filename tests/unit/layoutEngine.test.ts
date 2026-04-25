import { describe, expect, it } from "vitest"

import {
  applyFamilyTreeSpacingAdjustment,
  applyIncrementalFamilyTreeLayout,
  applyFamilyTreeMinimalMovement,
  deriveFamilyOrderFromLayout,
  layouts,
  resolveLayoutWithFallback
} from "@/lib/graph/layout"
import type { Edge, Entity } from "@/types"

describe("layout engines", () => {
  it("should_include_graph_and_family_tree_layouts_in_registry", () => {
    expect(layouts.graph).toBeTypeOf("function")
    expect(layouts.family_tree).toBeTypeOf("function")
  })

  it("should_return_positioned_nodes_for_graph_layout", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent" },
      { id: "c1", entity_kind: "person", display_name: "Child" }
    ]
    const edges: Edge[] = [
      {
        id: "e1",
        relationship_type: "parent_child",
        from_entity_id: "p1",
        to_entity_id: "c1",
        roles: { from: "parent", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const output = layouts.graph({ entities, edges })
    const parent = output.nodes.find((node) => node.id === "p1")
    const child = output.nodes.find((node) => node.id === "c1")

    expect(output.nodes).toHaveLength(2)
    expect(output.edges).toEqual([{ id: "e1" }])
    expect(parent).toBeDefined()
    expect(child).toBeDefined()
    expect((parent?.y ?? 0) < (child?.y ?? 0)).toBe(true)
  })

  it("should_apply_spacing_config_for_graph_layout", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent" },
      { id: "c1", entity_kind: "person", display_name: "Child" }
    ]
    const edges: Edge[] = [
      {
        id: "e1",
        relationship_type: "parent_child",
        from_entity_id: "p1",
        to_entity_id: "c1",
        roles: { from: "parent", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const output = layouts.graph(
      { entities, edges },
      { horizontalSpacing: 220, verticalSpacing: 90 }
    )
    const byId = new Map(output.nodes.map((node) => [node.id, node]))

    expect(byId.get("p1")?.x ?? 0).toBe(0)
    expect(byId.get("c1")?.y ?? 0).toBe(90)
  })

  it("should_position_family_tree_by_generation_and_group_siblings", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent A" },
      { id: "p2", entity_kind: "person", display_name: "Parent B" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child A" },
      { id: "c2", entity_kind: "person", display_name: "Child B" }
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
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c2",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const output = layouts.family_tree(
      { entities, edges },
      { horizontalSpacing: 100, verticalSpacing: 80 }
    )
    const byId = new Map(output.nodes.map((node) => [node.id, node]))
    const p1 = byId.get("p1")
    const p2 = byId.get("p2")
    const family = byId.get("f1")
    const c1 = byId.get("c1")
    const c2 = byId.get("c2")

    expect(p1).toBeDefined()
    expect(p2).toBeDefined()
    expect(family).toBeDefined()
    expect(c1).toBeDefined()
    expect(c2).toBeDefined()

    const parentY = p1?.y ?? 0
    expect((p2?.y ?? 0) === parentY).toBe(true)
    expect((family?.y ?? 0) > parentY).toBe(true)
    expect((c1?.y ?? 0) > parentY).toBe(true)
    expect((c2?.y ?? 0) > parentY).toBe(true)
    expect((family?.y ?? 0) < (c1?.y ?? 0)).toBe(true)
    expect((family?.y ?? 0) < (c2?.y ?? 0)).toBe(true)
    expect(Math.abs((c1?.x ?? 0) - (c2?.x ?? 0))).toBe(100)
  })

  it("should_generate_orthogonal_path_data_for_family_edges", () => {
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

    const output = layouts.family_tree({ entities, edges })
    const byEdgeId = new Map(output.edges.map((edge) => [edge.id, edge]))
    const parentEdgePath = byEdgeId.get("e1")?.path as Record<string, unknown> | undefined
    const childEdgePath = byEdgeId.get("e2")?.path as Record<string, unknown> | undefined

    expect(parentEdgePath?.kind).toBe("orthogonal")
    expect(typeof parentEdgePath?.connectorY).toBe("number")
    expect(childEdgePath?.kind).toBe("orthogonal")
    expect(typeof childEdgePath?.connectorY).toBe("number")
  })

  it("should_place_romantic_partners_on_same_level_and_adjacent", () => {
    const entities: Entity[] = [
      { id: "a", entity_kind: "person", display_name: "Alex" },
      { id: "b", entity_kind: "person", display_name: "Blair" },
      { id: "f", entity_kind: "family", display_name: "Family" },
      { id: "c", entity_kind: "person", display_name: "Child" }
    ]
    const edges: Edge[] = [
      {
        id: "r1",
        relationship_type: "romantic",
        from_entity_id: "a",
        to_entity_id: "b",
        roles: { from: "partner", to: "partner" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e1",
        relationship_type: "family_parent",
        from_entity_id: "a",
        to_entity_id: "f",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e2",
        relationship_type: "family_parent",
        from_entity_id: "b",
        to_entity_id: "f",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f",
        to_entity_id: "c",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const output = layouts.family_tree(
      { entities, edges },
      { horizontalSpacing: 100, verticalSpacing: 80 }
    )
    const byId = new Map(output.nodes.map((node) => [node.id, node]))
    const byEdgeId = new Map(output.edges.map((edge) => [edge.id, edge]))
    const a = byId.get("a")
    const b = byId.get("b")
    const romanticPath = byEdgeId.get("r1")?.path as Record<string, unknown> | undefined

    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a?.y).toBe(b?.y)
    expect(Math.abs((a?.x ?? 0) - (b?.x ?? 0))).toBe(100)
    expect(romanticPath?.kind).toBe("orthogonal_horizontal")
  })

  it("should_place_pets_one_generation_below_owners_and_under_owner_group", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Owner A" },
      { id: "p2", entity_kind: "person", display_name: "Owner B" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child" },
      { id: "pet1", entity_kind: "animal", display_name: "Pet" }
    ]
    const edges: Edge[] = [
      {
        id: "e1",
        relationship_type: "family_parent",
        from_entity_id: "p1",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e2",
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "animal",
        from_entity_id: "p1",
        to_entity_id: "pet1",
        roles: { from: "owner", to: "pet" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e5",
        relationship_type: "animal",
        from_entity_id: "p2",
        to_entity_id: "pet1",
        roles: { from: "owner", to: "pet" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const output = layouts.family_tree(
      { entities, edges },
      { horizontalSpacing: 100, verticalSpacing: 80 }
    )
    const byId = new Map(output.nodes.map((node) => [node.id, node]))
    const byEdgeId = new Map(output.edges.map((edge) => [edge.id, edge]))
    const ownersCenter = ((byId.get("p1")?.x ?? 0) + (byId.get("p2")?.x ?? 0)) / 2
    const pet = byId.get("pet1")
    const child = byId.get("c1")
    const owner = byId.get("p1")
    const petPath = byEdgeId.get("e4")?.path as Record<string, unknown> | undefined

    expect(owner).toBeDefined()
    expect(pet).toBeDefined()
    expect(child).toBeDefined()
    expect((pet?.y ?? 0) > (owner?.y ?? 0)).toBe(true)
    expect(pet?.y).toBe(child?.y)
    expect(Math.abs((pet?.x ?? 0) - ownersCenter)).toBeLessThanOrEqual(100)
    expect(petPath?.kind).toBe("orthogonal")
  })

  it("should_keep_sibling_subtrees_isolated_when_one_has_pet_and_other_has_child", () => {
    const entities: Entity[] = [
      { id: "gp1", entity_kind: "person", display_name: "Grand Parent 1" },
      { id: "gp2", entity_kind: "person", display_name: "Grand Parent 2" },
      { id: "fam0", entity_kind: "family", display_name: "Grand Family" },
      { id: "a", entity_kind: "person", display_name: "Sibling A" },
      { id: "b", entity_kind: "person", display_name: "Sibling B" },
      { id: "petA", entity_kind: "animal", display_name: "Pet A" },
      { id: "famB", entity_kind: "family", display_name: "B Family" },
      { id: "childB", entity_kind: "person", display_name: "Child B" }
    ]
    const edges: Edge[] = [
      {
        id: "e1",
        relationship_type: "family_parent",
        from_entity_id: "gp1",
        to_entity_id: "fam0",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e2",
        relationship_type: "family_parent",
        from_entity_id: "gp2",
        to_entity_id: "fam0",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "fam0",
        to_entity_id: "a",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "family_child",
        from_entity_id: "fam0",
        to_entity_id: "b",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e5",
        relationship_type: "animal",
        from_entity_id: "a",
        to_entity_id: "petA",
        roles: { from: "owner", to: "pet" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e6",
        relationship_type: "family_parent",
        from_entity_id: "b",
        to_entity_id: "famB",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e7",
        relationship_type: "family_child",
        from_entity_id: "famB",
        to_entity_id: "childB",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2020-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const output = layouts.family_tree(
      { entities, edges },
      { horizontalSpacing: 100, verticalSpacing: 80 }
    )
    const byId = new Map(output.nodes.map((node) => [node.id, node]))

    const aX = byId.get("a")?.x ?? 0
    const bX = byId.get("b")?.x ?? 0
    const petAX = byId.get("petA")?.x ?? 0
    const childBX = byId.get("childB")?.x ?? 0

    expect(aX < bX).toBe(true)
    expect(petAX <= aX + 1e-6).toBe(true)
    expect(childBX >= bX - 1e-6).toBe(true)
    expect(petAX < childBX).toBe(true)
  })

  it("should_sort_siblings_by_birth_date_when_available", () => {
    const entities = [
      { id: "p1", entity_kind: "person", display_name: "Parent" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child Later", birth_date: "2012-01-01" },
      { id: "c2", entity_kind: "person", display_name: "Child Earlier", birth_date: "2010-01-01" }
    ] as unknown as Entity[]
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
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c2",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const output = layouts.family_tree(
      { entities, edges },
      { horizontalSpacing: 100, verticalSpacing: 80 }
    )
    const byId = new Map(output.nodes.map((node) => [node.id, node]))

    expect((byId.get("c2")?.x ?? 0) < (byId.get("c1")?.x ?? 0)).toBe(true)
  })

  it("should_fallback_to_stable_name_order_for_siblings_without_birth_date", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c2", entity_kind: "person", display_name: "Zed Child" },
      { id: "c1", entity_kind: "person", display_name: "Alpha Child" }
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
        to_entity_id: "c2",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const output = layouts.family_tree(
      { entities, edges },
      { horizontalSpacing: 100, verticalSpacing: 80 }
    )
    const byId = new Map(output.nodes.map((node) => [node.id, node]))

    expect((byId.get("c1")?.x ?? 0) < (byId.get("c2")?.x ?? 0)).toBe(true)
  })

  it("should_fallback_to_graph_layout_when_family_has_too_many_parents", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "P1" },
      { id: "p2", entity_kind: "person", display_name: "P2" },
      { id: "p3", entity_kind: "person", display_name: "P3" },
      { id: "p4", entity_kind: "person", display_name: "P4" },
      { id: "p5", entity_kind: "person", display_name: "P5" },
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
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_parent",
        from_entity_id: "p3",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "family_parent",
        from_entity_id: "p4",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e5",
        relationship_type: "family_parent",
        from_entity_id: "p5",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e6",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const resolved = resolveLayoutWithFallback("family_tree", { entities, edges })

    expect(resolved.resolvedMode).toBe("graph")
    expect(resolved.fallbackReason).toBe("too_many_parents")
    expect(resolved.output.edges.every((edge) => edge.path === undefined)).toBe(true)
  })

  it("should_fallback_to_graph_layout_when_child_belongs_to_multiple_families", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "P1" },
      { id: "p2", entity_kind: "person", display_name: "P2" },
      { id: "f1", entity_kind: "family", display_name: "Family A" },
      { id: "f2", entity_kind: "family", display_name: "Family B" },
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
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f2",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "family_child",
        from_entity_id: "f2",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const resolved = resolveLayoutWithFallback("family_tree", { entities, edges })

    expect(resolved.resolvedMode).toBe("graph")
    expect(resolved.fallbackReason).toBe("unsupported_structure")
  })

  it("should_only_move_local_family_subtree_for_incremental_add", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent 1" },
      { id: "f1", entity_kind: "family", display_name: "Family 1" },
      { id: "a1", entity_kind: "person", display_name: "A Child 1" },
      { id: "a2", entity_kind: "person", display_name: "A Child 2" },
      { id: "p2", entity_kind: "person", display_name: "Parent 2" },
      { id: "f2", entity_kind: "family", display_name: "Family 2" },
      { id: "b1", entity_kind: "person", display_name: "B Child 1" }
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
        to_entity_id: "a1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "a2",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f2",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e5",
        relationship_type: "family_child",
        from_entity_id: "f2",
        to_entity_id: "b1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const spacing = { horizontalSpacing: 100, verticalSpacing: 80 }
    const previousOutput = layouts.family_tree({ entities, edges }, spacing)
    const previousPositions = Object.fromEntries(previousOutput.nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
    const previousOrder = deriveFamilyOrderFromLayout({ entities, edges }, previousOutput)

    const nextEntities: Entity[] = [
      ...entities,
      { id: "a3", entity_kind: "person", display_name: "A Child 3" }
    ]
    const nextEdges: Edge[] = [
      ...edges,
      {
        id: "e6",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "a3",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]
    const baseNextOutput = layouts.family_tree({ entities: nextEntities, edges: nextEdges }, spacing)

    const incremental = applyIncrementalFamilyTreeLayout(
      { entities: nextEntities, edges: nextEdges },
      {
        baseOutput: baseNextOutput,
        previousPositions,
        previousOrder,
        previousInput: { entities, edges },
        changeType: "local_add",
        addedNodeIds: ["a3"],
        removedNodeIds: [],
        addedEdgeIds: ["e6"],
        removedEdgeIds: [],
        config: spacing
      }
    )

    const byId = new Map(incremental.output.nodes.map((node) => [node.id, node]))
    expect(Math.abs((byId.get("p2")?.x ?? 0) - (previousPositions.p2?.x ?? 0))).toBeLessThan(1e-6)
    expect(Math.abs((byId.get("f2")?.x ?? 0) - (previousPositions.f2?.x ?? 0))).toBeLessThan(1e-6)
    expect(Math.abs((byId.get("b1")?.x ?? 0) - (previousPositions.b1?.x ?? 0))).toBeLessThan(1e-6)
    expect((byId.get("a3")?.x ?? 0) > (byId.get("a2")?.x ?? 0)).toBe(true)
  })

  it("should_keep_family_nodes_parent_anchored_in_minimal_movement_output", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent A" },
      { id: "p2", entity_kind: "person", display_name: "Parent B" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child 1" },
      { id: "c2", entity_kind: "person", display_name: "Child 2" }
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
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c2",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const spacing = { horizontalSpacing: 100, verticalSpacing: 80 }
    const base = layouts.family_tree({ entities, edges }, spacing)
    const previousPositions = Object.fromEntries(base.nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
    const moved = applyFamilyTreeMinimalMovement({ entities, edges }, base, previousPositions, spacing)
    const byId = new Map(moved.nodes.map((node) => [node.id, node]))
    const parentMidpoint = ((byId.get("p1")?.x ?? 0) + (byId.get("p2")?.x ?? 0)) / 2

    expect(Math.abs((byId.get("f1")?.x ?? 0) - parentMidpoint)).toBeLessThan(1e-6)
  })

  it("should_produce_finite_positions_for_global_change_minimal_movement_path", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent A" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child 1" }
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

    const spacing = { horizontalSpacing: 120, verticalSpacing: 90 }
    const previous = layouts.family_tree({ entities, edges }, spacing)
    const previousPositions = Object.fromEntries(previous.nodes.map((node) => [node.id, { x: node.x, y: node.y }]))

    const next = layouts.family_tree(
      {
        entities: [...entities, { id: "c2", entity_kind: "person", display_name: "Child 2" }],
        edges: [
          ...edges,
          {
            id: "e3",
            relationship_type: "family_child",
            from_entity_id: "f1",
            to_entity_id: "c2",
            roles: { from: "family", to: "child" },
            active: true,
            start: "2026-01-01T00:00:00.000Z",
            end: null
          }
        ]
      },
      spacing
    )
    const stabilized = applyFamilyTreeMinimalMovement(
      {
        entities: [...entities, { id: "c2", entity_kind: "person", display_name: "Child 2" }],
        edges: [
          ...edges,
          {
            id: "e3",
            relationship_type: "family_child",
            from_entity_id: "f1",
            to_entity_id: "c2",
            roles: { from: "family", to: "child" },
            active: true,
            start: "2026-01-01T00:00:00.000Z",
            end: null
          }
        ]
      },
      next,
      previousPositions,
      spacing
    )

    for (const node of stabilized.nodes) {
      expect(Number.isFinite(node.x)).toBe(true)
      expect(Number.isFinite(node.y)).toBe(true)
    }
  })

  it("should_keep_animal_dependent_centered_under_owners_in_incremental_layout", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Owner A" },
      { id: "p2", entity_kind: "person", display_name: "Owner B" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child 1" },
      { id: "pet1", entity_kind: "animal", display_name: "Pet 1" }
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
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "animal",
        from_entity_id: "p1",
        to_entity_id: "pet1",
        roles: { from: "owner", to: "pet" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e5",
        relationship_type: "animal",
        from_entity_id: "p2",
        to_entity_id: "pet1",
        roles: { from: "owner", to: "pet" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const spacing = { horizontalSpacing: 110, verticalSpacing: 80 }
    const previousOutput = layouts.family_tree({ entities, edges }, spacing)
    const previousPositions = Object.fromEntries(previousOutput.nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
    const previousOrder = deriveFamilyOrderFromLayout({ entities, edges }, previousOutput)

    const nextEntities: Entity[] = [...entities, { id: "c2", entity_kind: "person", display_name: "Child 2" }]
    const nextEdges: Edge[] = [
      ...edges,
      {
        id: "e6",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c2",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]
    const baseNextOutput = layouts.family_tree({ entities: nextEntities, edges: nextEdges }, spacing)
    const incremental = applyIncrementalFamilyTreeLayout(
      { entities: nextEntities, edges: nextEdges },
      {
        baseOutput: baseNextOutput,
        previousPositions,
        previousOrder,
        previousInput: { entities, edges },
        changeType: "local_add",
        addedNodeIds: ["c2"],
        removedNodeIds: [],
        addedEdgeIds: ["e6"],
        removedEdgeIds: [],
        config: spacing
      }
    )
    const byId = new Map(incremental.output.nodes.map((node) => [node.id, node]))
    const ownerMidpoint = ((byId.get("p1")?.x ?? 0) + (byId.get("p2")?.x ?? 0)) / 2
    expect(Math.abs((byId.get("pet1")?.x ?? 0) - ownerMidpoint)).toBeLessThan(1e-6)
  })

  it("should_keep_animal_dependent_centered_under_owners_in_minimal_movement_layout", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Owner A" },
      { id: "p2", entity_kind: "person", display_name: "Owner B" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "pet1", entity_kind: "animal", display_name: "Pet 1" }
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
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "animal",
        from_entity_id: "p1",
        to_entity_id: "pet1",
        roles: { from: "owner", to: "pet" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "animal",
        from_entity_id: "p2",
        to_entity_id: "pet1",
        roles: { from: "owner", to: "pet" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const spacing = { horizontalSpacing: 120, verticalSpacing: 90 }
    const output = layouts.family_tree({ entities, edges }, spacing)
    const previousPositions = Object.fromEntries(output.nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
    const moved = applyFamilyTreeMinimalMovement({ entities, edges }, output, previousPositions, spacing)
    const byId = new Map(moved.nodes.map((node) => [node.id, node]))
    const ownerMidpoint = ((byId.get("p1")?.x ?? 0) + (byId.get("p2")?.x ?? 0)) / 2
    expect(Math.abs((byId.get("pet1")?.x ?? 0) - ownerMidpoint)).toBeLessThan(1e-6)
  })

  it("should_preserve_relative_order_on_family_tree_spacing_change", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent A" },
      { id: "p2", entity_kind: "person", display_name: "Parent B" },
      { id: "f1", entity_kind: "family", display_name: "Family" },
      { id: "c1", entity_kind: "person", display_name: "Child 1" },
      { id: "c2", entity_kind: "person", display_name: "Child 2" },
      { id: "pet1", entity_kind: "animal", display_name: "Pet" }
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
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c1",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c2",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e5",
        relationship_type: "animal",
        from_entity_id: "p1",
        to_entity_id: "pet1",
        roles: { from: "owner", to: "pet" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e6",
        relationship_type: "animal",
        from_entity_id: "p2",
        to_entity_id: "pet1",
        roles: { from: "owner", to: "pet" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const previousConfig = { horizontalSpacing: 120, verticalSpacing: 90 }
    const nextConfig = { horizontalSpacing: 220, verticalSpacing: 90 }
    const previousOutput = layouts.family_tree({ entities, edges }, previousConfig)
    const previousPositions = Object.fromEntries(previousOutput.nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
    const previousOrder = deriveFamilyOrderFromLayout({ entities, edges }, previousOutput)
    const nextBaseOutput = layouts.family_tree({ entities, edges }, nextConfig)

    const adjusted = applyFamilyTreeSpacingAdjustment(
      { entities, edges },
      nextBaseOutput,
      previousPositions,
      previousOrder,
      previousConfig,
      nextConfig
    )
    const byId = new Map(adjusted.nodes.map((node) => [node.id, node]))
    const parentMidpoint = ((byId.get("p1")?.x ?? 0) + (byId.get("p2")?.x ?? 0)) / 2
    const familyChildren = (previousOrder.f1 ?? []).filter((id) => id === "c1" || id === "c2")
    const orderedChildren = [...familyChildren].sort((leftId, rightId) => {
      const leftX = byId.get(leftId)?.x ?? 0
      const rightX = byId.get(rightId)?.x ?? 0
      if (leftX !== rightX) {
        return leftX - rightX
      }
      return leftId.localeCompare(rightId, "en")
    })

    expect(orderedChildren).toEqual(familyChildren)
    expect(Math.abs((byId.get("f1")?.x ?? 0) - parentMidpoint)).toBeLessThan(1e-6)
    expect(Math.abs((byId.get("pet1")?.x ?? 0) - parentMidpoint)).toBeLessThan(1e-6)
  })

  it("should_keep_focus_siblings_ordered_and_place_external_partner_adjacent", () => {
    const entities: Entity[] = [
      { id: "p1", entity_kind: "person", display_name: "Parent A" },
      { id: "p2", entity_kind: "person", display_name: "Parent B" },
      { id: "f1", entity_kind: "family", display_name: "Family 1" },
      { id: "a", entity_kind: "person", display_name: "A" },
      { id: "b", entity_kind: "person", display_name: "B" },
      { id: "c", entity_kind: "person", display_name: "C" },
      { id: "q1", entity_kind: "person", display_name: "Parent Q" },
      { id: "f2", entity_kind: "family", display_name: "Family 2" },
      { id: "x", entity_kind: "person", display_name: "X" }
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
        relationship_type: "family_parent",
        from_entity_id: "p2",
        to_entity_id: "f1",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "a",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e4",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "b",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e5",
        relationship_type: "family_child",
        from_entity_id: "f1",
        to_entity_id: "c",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e6",
        relationship_type: "family_parent",
        from_entity_id: "q1",
        to_entity_id: "f2",
        roles: { from: "parent", to: "family" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e7",
        relationship_type: "family_child",
        from_entity_id: "f2",
        to_entity_id: "x",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      },
      {
        id: "e8",
        relationship_type: "romantic",
        from_entity_id: "b",
        to_entity_id: "x",
        roles: { from: "partner", to: "partner" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const spacing = { horizontalSpacing: 100, verticalSpacing: 80, focusNodeId: "b" }
    const output = layouts.family_tree({ entities, edges }, spacing)
    const byId = new Map(output.nodes.map((node) => [node.id, node]))
    const ax = byId.get("a")?.x ?? 0
    const bx = byId.get("b")?.x ?? 0
    const cx = byId.get("c")?.x ?? 0
    const xx = byId.get("x")?.x ?? 0

    expect(ax < bx).toBe(true)
    expect(bx < cx).toBe(true)
    expect(Math.abs(Math.abs(xx - bx) - spacing.horizontalSpacing)).toBeLessThan(1e-6)
  })
})
