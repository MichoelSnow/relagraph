import type { Edge, Entity, GraphResponse } from "@/types"

export type GraphState = {
  entities: Record<string, Entity>
  edges: Record<string, Edge>
}

export const EMPTY_GRAPH_STATE: GraphState = { entities: {}, edges: {} }

export function toGraphState(delta: GraphResponse): GraphState {
  return {
    entities: Object.fromEntries(delta.entities.map((entity) => [entity.id, entity])),
    edges: Object.fromEntries(delta.edges.map((edge) => [edge.id, edge]))
  }
}

export function mergeGraphState(previous: GraphState, delta: GraphState): GraphState {
  const nextEntities = { ...previous.entities }
  for (const entity of Object.values(delta.entities)) {
    nextEntities[entity.id] = entity
  }

  const nextEdges = { ...previous.edges }
  for (const edge of Object.values(delta.edges)) {
    nextEdges[edge.id] = edge
  }

  return {
    entities: nextEntities,
    edges: nextEdges
  }
}
