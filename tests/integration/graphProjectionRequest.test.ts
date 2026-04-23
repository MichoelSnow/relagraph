import { beforeEach, describe, expect, it, vi } from "vitest"

import { handleGraphProjectionRequest } from "@/server/api/graph_projection"
import type { GraphResponse } from "@/types"

const buildGraphDeltaFromCenterMock = vi.hoisted(() => vi.fn())

vi.mock("@/server/graph/projection", () => ({
  buildGraphDeltaFromCenter: buildGraphDeltaFromCenterMock
}))

describe("handleGraphProjectionRequest", () => {
  beforeEach(() => {
    buildGraphDeltaFromCenterMock.mockReset()
  })

  it("should_return_415_when_content_type_is_not_json", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    })

    const response = await handleGraphProjectionRequest({
      request,
      graphId: "g1",
      entityField: "center_entity_id",
      entityMissingMessage: "center_entity_id is required",
      entityNotFoundMessage: "Center entity does not exist"
    })

    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unsupported_media_type" }
    })
  })

  it("should_return_400_when_json_is_invalid", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    })

    const response = await handleGraphProjectionRequest({
      request,
      graphId: "g1",
      entityField: "center_entity_id",
      entityMissingMessage: "center_entity_id is required",
      entityNotFoundMessage: "Center entity does not exist"
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_json" }
    })
  })

  it("should_return_400_when_center_entity_id_is_missing", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ as_of: "2024-06-01T00:00:00.000Z", depth: 1 })
    })

    const response = await handleGraphProjectionRequest({
      request,
      graphId: "g1",
      entityField: "center_entity_id",
      entityMissingMessage: "center_entity_id is required",
      entityNotFoundMessage: "Center entity does not exist"
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { message: "center_entity_id is required" }
    })
  })

  it("should_return_400_when_as_of_is_invalid", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ center_entity_id: "e1", as_of: "bad", depth: 1 })
    })

    const response = await handleGraphProjectionRequest({
      request,
      graphId: "g1",
      entityField: "center_entity_id",
      entityMissingMessage: "center_entity_id is required",
      entityNotFoundMessage: "Center entity does not exist"
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { message: "as_of must be an ISO-8601 timestamp" }
    })
  })

  it("should_return_400_when_depth_is_negative", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ center_entity_id: "e1", as_of: "2024-06-01T00:00:00.000Z", depth: -1 })
    })

    const response = await handleGraphProjectionRequest({
      request,
      graphId: "g1",
      entityField: "center_entity_id",
      entityMissingMessage: "center_entity_id is required",
      entityNotFoundMessage: "Center entity does not exist"
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { message: "depth must be a non-negative integer" }
    })
  })

  it("should_return_404_when_center_entity_does_not_exist", async () => {
    buildGraphDeltaFromCenterMock.mockResolvedValueOnce(null)

    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        center_entity_id: "e_missing",
        as_of: "2024-06-01T00:00:00.000Z",
        depth: 1,
        already_loaded: { entity_ids: ["e1"], relationship_ids: ["r1"] }
      })
    })

    const response = await handleGraphProjectionRequest({
      request,
      graphId: "g1",
      entityField: "center_entity_id",
      entityMissingMessage: "center_entity_id is required",
      entityNotFoundMessage: "Center entity does not exist"
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "entity_not_found",
        details: { center_entity_id: "e_missing" }
      }
    })
  })

  it("should_return_graph_response_when_input_is_valid", async () => {
    const graphResponse: GraphResponse = {
      entities: [{ id: "e1", entity_kind: "person", display_name: "Alex" }],
      edges: [],
      meta: { truncated: false, node_count: 1, edge_count: 0 }
    }
    buildGraphDeltaFromCenterMock.mockResolvedValueOnce(graphResponse)

    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        center_entity_id: "e1",
        as_of: "2024-06-01T00:00:00.000Z",
        depth: 2,
        filters: {
          entity_types: ["person"],
          relationship_types: ["romantic"],
          include_inactive: true
        },
        already_loaded: {
          entity_ids: ["e0"],
          relationship_ids: ["r0"]
        }
      })
    })

    const response = await handleGraphProjectionRequest({
      request,
      graphId: "g1",
      entityField: "center_entity_id",
      entityMissingMessage: "center_entity_id is required",
      entityNotFoundMessage: "Center entity does not exist"
    })

    expect(buildGraphDeltaFromCenterMock).toHaveBeenCalledWith({
      graphId: "g1",
      centerEntityId: "e1",
      asOf: "2024-06-01T00:00:00.000Z",
      depth: 2,
      alreadyLoadedEntityIds: new Set(["e0"]),
      alreadyLoadedRelationshipIds: new Set(["r0"]),
      allowedEntityKinds: new Set(["person"]),
      allowedRelationshipTypes: new Set(["romantic"]),
      includeInactive: true
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(graphResponse)
  })
})
