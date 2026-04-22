import type { Entity } from "@/types"

type GraphSummary = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

function publicErrorMessage(status: number): string {
  if (status === 400 || status === 422) {
    return "Request could not be processed."
  }
  if (status === 401 || status === 403) {
    return "You are not authorized to perform this action."
  }
  if (status === 404) {
    return "Requested resource was not found."
  }
  if (status === 409) {
    return "Request could not be completed due to a conflict."
  }
  if (status === 429) {
    return "Too many requests. Please try again later."
  }
  if (status >= 500) {
    return "Server error. Please try again."
  }
  return "Request failed."
}

async function parseOrThrow(response: Response): Promise<unknown> {
  if (!response.ok) {
    await response.json().catch(() => null)
    throw new Error(publicErrorMessage(response.status))
  }

  return response.json()
}

export async function fetchGraphs(): Promise<GraphSummary[]> {
  const response = await fetch("/api/v1/graphs", { method: "GET" })
  const payload = (await parseOrThrow(response)) as { graphs: GraphSummary[] }
  return payload.graphs
}

export async function createGraph(name: string): Promise<{ id: string; name: string }> {
  const response = await fetch("/api/v1/graphs", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ name })
  })

  return (await parseOrThrow(response)) as { id: string; name: string }
}

export async function fetchGraphEntities(graphId: string): Promise<Entity[]> {
  const response = await fetch(`/api/v1/graphs/${graphId}/entities`, { method: "GET" })
  const payload = (await parseOrThrow(response)) as { entities: Entity[] }
  return payload.entities
}

export async function createGraphEntity(
  graphId: string,
  input: { entity_kind: "person" | "animal" | "place"; display_name: string }
): Promise<Entity> {
  const response = await fetch(`/api/v1/graphs/${graphId}/entities`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  })

  return (await parseOrThrow(response)) as Entity
}

type CreateRelationshipInput = {
  relationship_type: string
  participants: Array<{
    entity_id: string
    role: string
  }>
}

type CreateRelationshipResponse = {
  id: string
  relationship_type: string
  participants: Array<{
    relationship_id: string
    entity_id: string
    role: string
  }>
}

type CreateRelationshipIntervalInput = {
  start: string
  end: string | null
}

type CreateRelationshipIntervalResponse = {
  id: string
  relationship_id: string
  start: string
  end: string | null
}

type UpdateEntityInput = {
  entity_kind?: "person" | "animal" | "place"
  display_name?: string
  entity_name?: {
    name_text?: string
    name_type?: string
    language_code?: string | null
    script_code?: string | null
    notes?: string | null
    is_primary?: boolean
    sort_order?: number | null
    start_date?: string | null
    end_date?: string | null
  }
  profile?: Record<string, unknown>
}

type UpdateRelationshipInput = {
  relationship_type?: string
  participants?: Array<{
    entity_id: string
    role: string
  }>
}

export type GraphEntityDetail = Entity & {
  entity_name: {
    name_text: string
    name_type: string
    language_code: string | null
    script_code: string | null
    notes: string | null
    is_primary: boolean | null
    sort_order: number | null
    start_date: string | null
    end_date: string | null
  } | null
  entity_names: Array<{
    name_text: string
    name_type: string
    language_code: string | null
    script_code: string | null
    notes: string | null
    is_primary: boolean | null
    sort_order: number | null
    start_date: string | null
    end_date: string | null
  }>
  profile: Record<string, unknown> | null
}

export async function createRelationship(
  graphId: string,
  input: CreateRelationshipInput
): Promise<CreateRelationshipResponse> {
  const response = await fetch(`/api/v1/graphs/${graphId}/relationships`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  })

  return (await parseOrThrow(response)) as CreateRelationshipResponse
}

export async function createRelationshipInterval(
  graphId: string,
  relationshipId: string,
  input: CreateRelationshipIntervalInput
): Promise<CreateRelationshipIntervalResponse> {
  const response = await fetch(`/api/v1/graphs/${graphId}/relationships/${relationshipId}/intervals`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  })

  return (await parseOrThrow(response)) as CreateRelationshipIntervalResponse
}

export async function updateGraphEntity(
  graphId: string,
  entityId: string,
  input: UpdateEntityInput
): Promise<GraphEntityDetail> {
  const response = await fetch(`/api/v1/graphs/${graphId}/entities/${entityId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  })

  return (await parseOrThrow(response)) as GraphEntityDetail
}

export async function fetchGraphEntityDetail(
  graphId: string,
  entityId: string
): Promise<GraphEntityDetail> {
  const response = await fetch(`/api/v1/graphs/${graphId}/entities/${entityId}`, {
    method: "GET"
  })

  return (await parseOrThrow(response)) as GraphEntityDetail
}

export async function deleteGraphEntity(
  graphId: string,
  entityId: string
): Promise<void> {
  const response = await fetch(`/api/v1/graphs/${graphId}/entities/${entityId}`, {
    method: "DELETE"
  })
  await parseOrThrow(response)
}

export async function updateRelationship(
  graphId: string,
  relationshipId: string,
  input: UpdateRelationshipInput
): Promise<CreateRelationshipResponse> {
  const response = await fetch(`/api/v1/graphs/${graphId}/relationships/${relationshipId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  })

  return (await parseOrThrow(response)) as CreateRelationshipResponse
}
