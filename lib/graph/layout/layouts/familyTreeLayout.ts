import { runPipeline, type LayoutPipeline } from "@/lib/graph/layout/pipeline"
import { applyConstraints } from "@/lib/graph/layout/steps/applyConstraints"
import { assignOrder } from "@/lib/graph/layout/steps/assignOrder"
import { buildStructure } from "@/lib/graph/layout/steps/buildStructure"
import { computeLayout } from "@/lib/graph/layout/steps/computeLayout"
import { filterGraph } from "@/lib/graph/layout/steps/filterGraph"
import { routeEdges } from "@/lib/graph/layout/steps/routeEdges"

export const familyTreeLayout: LayoutPipeline = (ctx) =>
  runPipeline(
    ctx,
    [filterGraph, buildStructure, applyConstraints, assignOrder, computeLayout, routeEdges],
    (finalCtx) => ({
      nodes: finalCtx.layout?.nodes ?? [],
      edges: finalCtx.routedEdges ?? []
    })
  )
