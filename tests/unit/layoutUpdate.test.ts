import { describe, expect, it } from "vitest"

import { classifyLayoutChange } from "@/lib/graph/layoutUpdate"
import type { Edge, Entity } from "@/types"

function buildBaseGraph(): { entities: Entity[]; edges: Edge[] } {
  const entities: Entity[] = [
    { id: "p1", entity_kind: "person", display_name: "Parent" },
    { id: "a1", entity_kind: "person", display_name: "Anchor" },
    { id: "c1", entity_kind: "person", display_name: "Child 1" }
  ]
  const edges: Edge[] = [
    {
      id: "e1",
      relationship_type: "family_parent",
      from_entity_id: "p1",
      to_entity_id: "a1",
      roles: { from: "parent", to: "family" },
      active: true,
      start: "2026-01-01T00:00:00.000Z",
      end: null
    },
    {
      id: "e2",
      relationship_type: "family_child",
      from_entity_id: "a1",
      to_entity_id: "c1",
      roles: { from: "family", to: "child" },
      active: true,
      start: "2026-01-01T00:00:00.000Z",
      end: null
    }
  ]
  return { entities, edges }
}

describe("classifyLayoutChange", () => {
  it("classifies selection_only when topology is unchanged", () => {
    const { entities, edges } = buildBaseGraph()
    const result = classifyLayoutChange({
      previousEntities: entities,
      previousEdges: edges,
      entities,
      edges,
      topologyChanged: false,
      modeChanged: false,
      layoutEngineChanged: false,
      layoutConfigChanged: false
    })

    expect(result.changeType).toBe("selection_only")
    expect(result.addedNodeIds).toHaveLength(0)
    expect(result.removedNodeIds).toHaveLength(0)
  })

  it("classifies local_add for small additive topology changes", () => {
    const { entities, edges } = buildBaseGraph()
    const nextEntities: Entity[] = [
      ...entities,
      { id: "c2", entity_kind: "person", display_name: "Child 2" }
    ]
    const nextEdges: Edge[] = [
      ...edges,
      {
        id: "e3",
        relationship_type: "family_child",
        from_entity_id: "a1",
        to_entity_id: "c2",
        roles: { from: "family", to: "child" },
        active: true,
        start: "2026-01-01T00:00:00.000Z",
        end: null
      }
    ]

    const result = classifyLayoutChange({
      previousEntities: entities,
      previousEdges: edges,
      entities: nextEntities,
      edges: nextEdges,
      topologyChanged: true,
      modeChanged: false,
      layoutEngineChanged: false,
      layoutConfigChanged: false
    })

    expect(result.changeType).toBe("local_add")
    expect(result.addedNodeIds).toEqual(["c2"])
    expect(result.addedEdgeIds).toEqual(["e3"])
  })

  it("classifies local_remove for small removal changes", () => {
    const { entities, edges } = buildBaseGraph()
    const previousEntities: Entity[] = [
      ...entities,
      { id: "x1", entity_kind: "person", display_name: "Extra 1" },
      { id: "x2", entity_kind: "person", display_name: "Extra 2" }
    ]
    const result = classifyLayoutChange({
      previousEntities,
      previousEdges: edges,
      entities: previousEntities.filter((entity) => entity.id !== "c1"),
      edges: edges.filter((edge) => edge.id !== "e2"),
      topologyChanged: true,
      modeChanged: false,
      layoutEngineChanged: false,
      layoutConfigChanged: false
    })

    expect(result.changeType).toBe("local_remove")
    expect(result.removedNodeIds).toEqual(["c1"])
    expect(result.removedEdgeIds).toEqual(["e2"])
  })

  it("classifies global_change when mode/config changes", () => {
    const { entities, edges } = buildBaseGraph()
    const result = classifyLayoutChange({
      previousEntities: entities,
      previousEdges: edges,
      entities,
      edges,
      topologyChanged: true,
      modeChanged: true,
      layoutEngineChanged: false,
      layoutConfigChanged: false
    })

    expect(result.changeType).toBe("global_change")
  })
})
