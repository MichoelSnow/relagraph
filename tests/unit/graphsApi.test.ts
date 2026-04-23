import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createGraph,
  createGraphEntity,
  createRelationship,
  createRelationshipInterval,
  deleteGraphEntity,
  fetchGraphEntities,
  fetchGraphEntityDetail,
  fetchGraphs,
  updateGraphEntity,
  updateRelationship
} from "@/lib/api/graphs"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  })
}

describe("lib/api/graphs", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should_fetch_graphs_when_request_succeeds", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        graphs: [{ id: "g1", name: "Family", created_at: "a", updated_at: "b" }]
      })
    )

    const result = await fetchGraphs()

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/graphs", { method: "GET" })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe("g1")
  })

  it("should_create_graph_when_payload_is_valid", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ id: "g1", name: "Family" }, 201)
    )

    const result = await createGraph("Family")

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/graphs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Family" })
    })
    expect(result).toEqual({ id: "g1", name: "Family" })
  })

  it("should_fetch_entities_when_request_succeeds", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ entities: [{ id: "e1", entity_kind: "person", display_name: "Alex" }] })
    )

    const result = await fetchGraphEntities("g1")

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/graphs/g1/entities", { method: "GET" })
    expect(result[0]?.id).toBe("e1")
  })

  it("should_create_entity_when_payload_is_valid", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ id: "e1", entity_kind: "person", display_name: "Alex" }, 201)
    )

    const result = await createGraphEntity("g1", { entity_kind: "person", display_name: "Alex" })

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/graphs/g1/entities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity_kind: "person", display_name: "Alex" })
    })
    expect(result.display_name).toBe("Alex")
  })

  it("should_create_relationship_and_interval_when_requests_succeed", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          id: "r1",
          relationship_type: "romantic",
          participants: [
            { relationship_id: "r1", entity_id: "e1", role: "partner" },
            { relationship_id: "r1", entity_id: "e2", role: "partner" }
          ]
        }, 201)
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "i1", relationship_id: "r1", start: "2020-01-01T00:00:00.000Z", end: null }, 201)
      )

    const relationship = await createRelationship("g1", {
      relationship_type: "romantic",
      participants: [
        { entity_id: "e1", role: "partner" },
        { entity_id: "e2", role: "partner" }
      ]
    })
    const interval = await createRelationshipInterval("g1", "r1", {
      start: "2020-01-01T00:00:00.000Z",
      end: null
    })

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/graphs/g1/relationships", expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/graphs/g1/relationships/r1/intervals", expect.any(Object))
    expect(relationship.id).toBe("r1")
    expect(interval.id).toBe("i1")
  })

  it("should_fetch_and_update_entity_detail_when_requests_succeed", async () => {
    const detail = {
      id: "e1",
      entity_kind: "person",
      display_name: "Alex",
      entity_name: null,
      entity_names: [],
      profile: null
    }

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(detail))
      .mockResolvedValueOnce(jsonResponse(detail))

    const fetched = await fetchGraphEntityDetail("g1", "e1")
    const updated = await updateGraphEntity("g1", "e1", { display_name: "Alex" })

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/graphs/g1/entities/e1", { method: "GET" })
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/graphs/g1/entities/e1", expect.objectContaining({ method: "PATCH" }))
    expect(fetched.id).toBe("e1")
    expect(updated.id).toBe("e1")
  })

  it("should_update_relationship_when_payload_is_valid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ id: "r1", relationship_type: "familial", participants: [] })
    )

    const result = await updateRelationship("g1", "r1", {
      relationship_type: "familial",
      participants: []
    })

    expect(result.relationship_type).toBe("familial")
  })

  it("should_throw_public_404_error_when_delete_fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ error: {} }, 404))

    await expect(deleteGraphEntity("g1", "e404")).rejects.toThrow("Requested resource was not found.")
  })

  it("should_throw_public_500_error_when_update_fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ error: {} }, 500))

    await expect(updateRelationship("g1", "r1", { relationship_type: "x" })).rejects.toThrow(
      "Server error. Please try again."
    )
  })

  it("should_throw_public_401_error_when_error_body_is_not_json", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401, headers: { "content-type": "text/plain" } })
    )

    await expect(fetchGraphs()).rejects.toThrow("You are not authorized to perform this action.")
  })
})
