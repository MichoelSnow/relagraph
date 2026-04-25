import type { Edge, Entity } from "@/types"
import type { LayoutChangeType } from "@/lib/graph/layout/types"

type ChangeInput = {
  previousEntities: Entity[]
  previousEdges: Edge[]
  entities: Entity[]
  edges: Edge[]
  topologyChanged: boolean
  modeChanged: boolean
  layoutEngineChanged: boolean
  layoutConfigChanged: boolean
}

export type ClassifiedLayoutChange = {
  changeType: LayoutChangeType
  addedNodeIds: string[]
  removedNodeIds: string[]
  addedEdgeIds: string[]
  removedEdgeIds: string[]
}

export function classifyLayoutChange(input: ChangeInput): ClassifiedLayoutChange {
  const previousNodeIds = new Set(input.previousEntities.map((entity) => entity.id))
  const currentNodeIds = new Set(input.entities.map((entity) => entity.id))
  const previousEdgeIds = new Set(input.previousEdges.map((edge) => edge.id))
  const currentEdgeIds = new Set(input.edges.map((edge) => edge.id))

  const addedNodeIds = [...currentNodeIds].filter((id) => !previousNodeIds.has(id))
  const removedNodeIds = [...previousNodeIds].filter((id) => !currentNodeIds.has(id))
  const addedEdgeIds = [...currentEdgeIds].filter((id) => !previousEdgeIds.has(id))
  const removedEdgeIds = [...previousEdgeIds].filter((id) => !currentEdgeIds.has(id))

  const sharedNodeCount = [...currentNodeIds].filter((id) => previousNodeIds.has(id)).length
  const nodeUnionCount = new Set([...previousNodeIds, ...currentNodeIds]).size
  const sharedRatio = nodeUnionCount === 0 ? 1 : sharedNodeCount / nodeUnionCount

  let changeType: LayoutChangeType = "selection_only"
  if (!input.topologyChanged) {
    changeType = "selection_only"
  } else if (input.modeChanged || input.layoutEngineChanged || input.layoutConfigChanged) {
    changeType = "global_change"
  } else {
    const localCandidate =
      sharedRatio >= 0.75 &&
      addedNodeIds.length + removedNodeIds.length + addedEdgeIds.length + removedEdgeIds.length <= 12
    if (localCandidate) {
      if (addedNodeIds.length + addedEdgeIds.length > 0 && removedNodeIds.length + removedEdgeIds.length === 0) {
        changeType = "local_add"
      } else if (removedNodeIds.length + removedEdgeIds.length > 0 && addedNodeIds.length + addedEdgeIds.length === 0) {
        changeType = "local_remove"
      } else {
        changeType = "global_change"
      }
    } else {
      changeType = "global_change"
    }
  }

  return {
    changeType,
    addedNodeIds,
    removedNodeIds,
    addedEdgeIds,
    removedEdgeIds
  }
}
