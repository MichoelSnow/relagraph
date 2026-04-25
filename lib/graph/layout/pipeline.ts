import type { Edge, Entity } from "@/types"

export type LayoutContext = {
  entities: Entity[]
  edges: Edge[]
  focusNodeId?: string
  distance?: number
  previousPositions?: Record<string, { x: number; y: number }>
  previousOrder?: Record<string, string[]>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structure?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constrained?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ordered?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  routedEdges?: any
  layoutConfig?: {
    horizontalSpacing: number
    verticalSpacing: number
    focusNodeId?: string | null
  }
  result?: LayoutResult
}

export type LayoutResult = {
  nodes: { id: string; x: number; y: number }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: { id: string; path?: any }[]
}

export type LayoutStage = (ctx: LayoutContext) => LayoutContext

export type LayoutPipeline = (ctx: LayoutContext) => LayoutResult

export function runPipeline(
  ctx: LayoutContext,
  stages: LayoutStage[],
  finalize: (ctx: LayoutContext) => LayoutResult
): LayoutResult {
  let current = ctx
  for (const stage of stages) {
    current = stage(current)
  }
  return finalize(current)
}
