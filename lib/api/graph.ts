import type { GraphResponse } from "@/types"

type GraphFilters = {
  entity_types: string[]
  relationship_types: string[]
  include_inactive: boolean
}

type AlreadyLoaded = {
  entity_ids: string[]
  relationship_ids: string[]
}

type GraphViewRequest = {
  graph_id: string
  center_entity_id: string
  as_of: string
  depth: number
  filters: GraphFilters
  already_loaded: AlreadyLoaded
}

type GraphExpandRequest = {
  graph_id: string
  entity_id: string
  as_of: string
  depth: number
  filters: GraphFilters
  already_loaded: AlreadyLoaded
}

type ApiErrorEnvelope = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

async function postJson<TRequest extends object, TResponse>(
  path: string,
  body: TRequest
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
    const message = errorBody?.error?.message ?? `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return (await response.json()) as TResponse
}

export async function fetchGraphView(input: GraphViewRequest): Promise<GraphResponse> {
  return postJson<GraphViewRequest, GraphResponse>(
    `/api/v1/graphs/${input.graph_id}/graph/view`,
    input
  )
}

export async function fetchGraphExpand(input: GraphExpandRequest): Promise<GraphResponse> {
  return postJson<GraphExpandRequest, GraphResponse>(
    `/api/v1/graphs/${input.graph_id}/graph/expand`,
    input
  )
}
