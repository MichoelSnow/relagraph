import { familyTreeLayout } from "@/lib/graph/layout/layouts/familyTreeLayout"
import { graphLayout } from "@/lib/graph/layout/layouts/graphLayout"

export const layoutRegistry = {
  family_tree: familyTreeLayout,
  graph: graphLayout
} as const
