import type { Entity } from "@/types"

type ApiErrorEnvelope = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

type GraphSummary = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

async function parseOrThrow(response: Response): Promise<unknown> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
    throw new Error(errorBody?.error?.message ?? `Request failed with status ${response.status}`)
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
