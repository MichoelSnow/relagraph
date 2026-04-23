import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildGraphDeltaFromCenter } from "@/server/graph/projection"

type AwaitableQuery<T> = PromiseLike<T[]> & {
  limit: (count: number) => Promise<T[]>
}

function toAwaitableQuery<T>(rows: T[]): AwaitableQuery<T> {
  return {
    limit: async (count: number) => rows.slice(0, count),
    then: (onFulfilled, onRejected) => Promise.resolve(rows).then(onFulfilled, onRejected)
  }
}

function createMockDb(resultQueue: unknown[][]) {
  return {
    select() {
      return {
        from() {
          return {
            innerJoin() {
              return this
            },
            where() {
              const next = resultQueue.shift() ?? []
              return toAwaitableQuery(next)
            }
          }
        }
      }
    }
  }
}

const getDbMock = vi.hoisted(() => vi.fn())

vi.mock("@/db/client", () => ({
  getDb: getDbMock
}))

describe("buildGraphDeltaFromCenter", () => {
  beforeEach(() => {
    getDbMock.mockReset()
  })

  it("should_return_null_when_center_entity_does_not_exist", async () => {
    getDbMock.mockReturnValue(createMockDb([[]]))

    const result = await buildGraphDeltaFromCenter({
      graphId: "g1",
      centerEntityId: "missing",
      asOf: "2026-01-01T00:00:00.000Z",
      depth: 1,
      alreadyLoadedEntityIds: new Set(),
      alreadyLoadedRelationshipIds: new Set(),
      allowedEntityKinds: null,
      allowedRelationshipTypes: null,
      includeInactive: false
    })

    expect(result).toBeNull()
  })

  it("should_return_empty_graph_when_center_kind_is_filtered_out", async () => {
    getDbMock.mockReturnValue(
      createMockDb([
        [{ id: "e1", entityKind: "person", canonicalDisplayName: "Alex" }]
      ])
    )

    const result = await buildGraphDeltaFromCenter({
      graphId: "g1",
      centerEntityId: "e1",
      asOf: "2026-01-01T00:00:00.000Z",
      depth: 1,
      alreadyLoadedEntityIds: new Set(),
      alreadyLoadedRelationshipIds: new Set(),
      allowedEntityKinds: new Set(["animal"]),
      allowedRelationshipTypes: null,
      includeInactive: false
    })

    expect(result).toEqual({
      entities: [],
      edges: [],
      meta: { truncated: false, node_count: 0, edge_count: 0 }
    })
  })

  it("should_build_active_edge_and_entities_when_traversal_data_is_valid", async () => {
    getDbMock.mockReturnValue(
      createMockDb([
        [{ id: "e1", entityKind: "person", canonicalDisplayName: "Alex" }],
        [{ relationshipId: "r1" }],
        [{ id: "r1", relationshipType: "romantic" }],
        [
          { relationshipId: "r1", entityId: "e1", role: "partner" },
          { relationshipId: "r1", entityId: "e2", role: "partner" }
        ],
        [{ relationshipId: "r1", validFrom: "2020-01-01T00:00:00.000Z", validTo: null }],
        [{ id: "e2", entityKind: "person", canonicalDisplayName: "Blair" }]
      ])
    )

    const result = await buildGraphDeltaFromCenter({
      graphId: "g1",
      centerEntityId: "e1",
      asOf: "2026-01-01T00:00:00.000Z",
      depth: 1,
      alreadyLoadedEntityIds: new Set(["e1"]),
      alreadyLoadedRelationshipIds: new Set(),
      allowedEntityKinds: null,
      allowedRelationshipTypes: new Set(["romantic"]),
      includeInactive: false
    })

    expect(result).toEqual({
      entities: [{ id: "e2", entity_kind: "person", display_name: "Blair" }],
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
    })
  })

  it("should_exclude_inactive_edges_when_include_inactive_is_false", async () => {
    getDbMock.mockReturnValue(
      createMockDb([
        [{ id: "e1", entityKind: "person", canonicalDisplayName: "Alex" }],
        [{ relationshipId: "r1" }],
        [{ id: "r1", relationshipType: "romantic" }],
        [
          { relationshipId: "r1", entityId: "e1", role: "partner" },
          { relationshipId: "r1", entityId: "e2", role: "partner" }
        ],
        [{ relationshipId: "r1", validFrom: "2020-01-01T00:00:00.000Z", validTo: "2021-01-01T00:00:00.000Z" }],
        [{ id: "e2", entityKind: "person", canonicalDisplayName: "Blair" }]
      ])
    )

    const result = await buildGraphDeltaFromCenter({
      graphId: "g1",
      centerEntityId: "e1",
      asOf: "2026-01-01T00:00:00.000Z",
      depth: 1,
      alreadyLoadedEntityIds: new Set(),
      alreadyLoadedRelationshipIds: new Set(),
      allowedEntityKinds: null,
      allowedRelationshipTypes: null,
      includeInactive: false
    })

    expect(result).toEqual({
      entities: [{ id: "e1", entity_kind: "person", display_name: "Alex" }],
      edges: [],
      meta: { truncated: false, node_count: 1, edge_count: 0 }
    })
  })

})
