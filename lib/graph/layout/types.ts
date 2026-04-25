import type { Edge, Entity } from "@/types"

export type LayoutMode = "graph" | "family_tree"

export type LayoutInput = {
  entities: Entity[]
  edges: Edge[]
}

export type LayoutOutput = {
  nodes: { id: string; x: number; y: number }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: { id: string; path?: any }[]
}

export type NodePosition = { x: number; y: number }
export type PreviousPositions = Record<string, NodePosition>
export type PreviousOrder = Record<string, string[]>

export type LayoutChangeType = "selection_only" | "local_add" | "local_remove" | "global_change"

export type LayoutConfig = {
  horizontalSpacing: number
  verticalSpacing: number
  focusNodeId?: string | null
}
