"use client"

import cytoscape, { type ElementDefinition } from "cytoscape"
import { useEffect, useMemo, useRef } from "react"

import {
  applyIncrementalFamilyTreeLayout,
  applyFamilyTreeMinimalMovement,
  deriveFamilyOrderFromLayout,
  type LayoutChangeType,
  resolveLayoutWithFallback,
  type LayoutConfig,
  type LayoutInput,
  type LayoutMode as LayoutEngineMode,
  type LayoutOutput,
  type PreviousOrder,
  type PreviousPositions
} from "@/lib/graph/layout"
import type { Edge, Entity } from "@/types"
import { normalizeRelationshipTypeCode } from "@/lib/graph/relationshipType"
import { graphTheme, resolveGraphTheme, type ResolvedGraphTheme } from "@/lib/ui/graphTheme"

type GraphCanvasProps = {
  entities: Entity[]
  edges: Edge[]
  layoutMode?: "auto" | "manual"
  layoutEngineMode?: LayoutEngineMode
  layoutConfig?: LayoutConfig
  selectedEntityId?: string | null
  showNodeLabels?: boolean
  showRelationshipLabels?: boolean
  onNodeClick: (entityId: string) => void
  onEdgeClick?: (relationshipId: string) => void
}

function colorForRelationshipType(value: string): string {
  const normalized = normalizeRelationshipTypeCode(value)
  if (normalized === "parent_child") {
    return "#2563eb"
  }
  if (normalized === "romantic") {
    return "#e11d48"
  }
  if (normalized === "animal") {
    return "#16a34a"
  }
  if (normalized === "sibling") {
    return "#f59e0b"
  }
  if (normalized === "family_parent") {
    return "#334155"
  }
  if (normalized === "family_child") {
    return "#475569"
  }
  return "#64748b"
}

function applyLayoutOutput(
  cy: cytoscape.Core,
  output: LayoutOutput,
  options?: {
    animate?: boolean
    durationMs?: number
    newNodeInitialPositions?: Record<string, { x: number; y: number }>
  }
) {
  const shouldAnimate = options?.animate ?? true
  const durationMs = options?.durationMs ?? 220
  const newNodeInitialPositions = options?.newNodeInitialPositions ?? {}

  if (!shouldAnimate) {
    cy.batch(() => {
      for (const positionedNode of output.nodes) {
        const node = cy.getElementById(positionedNode.id)
        if (node.length === 0) {
          continue
        }
        node.stop()
        node.position({
          x: positionedNode.x,
          y: positionedNode.y
        })
      }
    })
    return
  }

  for (const positionedNode of output.nodes) {
    const node = cy.getElementById(positionedNode.id)
    if (node.length === 0) {
      continue
    }
    node.stop()
    const initial = newNodeInitialPositions[positionedNode.id]
    if (initial) {
      node.position({ x: initial.x, y: initial.y })
      node.style("opacity", 0.2)
    }
    node.animate(
      {
        position: {
          x: positionedNode.x,
          y: positionedNode.y
        },
        style: initial
          ? {
              opacity: 1
            }
          : undefined
      },
      {
        duration: durationMs,
        easing: "ease-in-out"
      }
    )
  }
}

function buildCanvasStyles(
  resolvedTheme: ResolvedGraphTheme,
  showNodeLabels: boolean,
  showRelationshipLabels: boolean
): Array<Record<string, unknown>> {
  return [
    {
      selector: "node[entityKind = 'person']",
      style: {
        "background-color": resolvedTheme.node.person
      }
    },
    {
      selector: "node[entityKind = 'animal']",
      style: {
        "background-color": resolvedTheme.node.animal
      }
    },
    {
      selector: "node[entityKind = 'place']",
      style: {
        "background-color": resolvedTheme.node.place
      }
    },
    {
      selector: "node[entityKind = 'family']",
      style: {
        "background-color": "#64748b",
        shape: "round-rectangle",
        width: 44,
        height: 28
      }
    },
    {
      selector: "node",
      style: {
        label: showNodeLabels ? "data(label)" : "",
        color: resolvedTheme.node.text,
        "text-valign": "bottom",
        "text-margin-y": 8,
        "font-size": 12,
        width: 26,
        height: 26,
        "border-width": 1.5,
        "border-color": resolvedTheme.node.border,
        "text-background-color": resolvedTheme.node.textBg,
        "text-background-opacity": 1,
        "text-background-padding": "3px",
        "text-background-shape": "roundrectangle"
      }
    },
    {
      selector: 'node[isSelected = "true"]',
      style: {
        "border-width": 5,
        "border-color": resolvedTheme.node.selectedBorder
      }
    },
    {
      selector: "edge",
      style: {
        width: 2,
        label: showRelationshipLabels ? "data(relationshipType)" : "",
        color: resolvedTheme.edge.text,
        "font-size": 10,
        "text-background-color": resolvedTheme.edge.textBg,
        "text-background-opacity": 1,
        "text-background-padding": "2px",
        "line-color": resolvedTheme.edge.line,
        "target-arrow-shape": "none",
        "curve-style": "bezier"
      }
    },
    {
      selector: 'edge[routingStyle = "orthogonal"]',
      style: {
        "curve-style": "taxi",
        "taxi-direction": "downward",
        "taxi-turn": "50%",
        "taxi-turn-min-distance": 12
      }
    },
    {
      selector: 'edge[routingStyle = "orthogonal-horizontal"]',
      style: {
        "curve-style": "taxi",
        "taxi-direction": "rightward",
        "taxi-turn": "50%",
        "taxi-turn-min-distance": 10
      }
    },
    {
      selector: "edge[line_color]",
      style: {
        "line-color": "data(line_color)"
      }
    },
    {
      selector: 'edge[active = "false"]',
      style: {
        opacity: 0.45,
        "line-style": "dashed"
      }
    }
  ]
}

function resolveNodeLabel(entity: Entity): string {
  if (entity.entity_kind === "family") {
    const label = entity.display_name.trim()
    return label.length > 0 ? label : "Family"
  }

  return entity.display_name
}

export default function GraphCanvas({
  entities,
  edges,
  layoutMode = "auto",
  layoutEngineMode = "graph",
  layoutConfig = { horizontalSpacing: 180, verticalSpacing: 180 },
  selectedEntityId,
  showNodeLabels = true,
  showRelationshipLabels = false,
  onNodeClick,
  onEdgeClick
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasShellRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const previousTopologyKeyRef = useRef("")
  const previousLayoutModeRef = useRef<"auto" | "manual">(layoutMode)
  const previousLayoutEngineModeRef = useRef<LayoutEngineMode>(layoutEngineMode)
  const previousLayoutConfigKeyRef = useRef(`${layoutConfig.horizontalSpacing}|${layoutConfig.verticalSpacing}`)
  const previousPositionsRef = useRef<PreviousPositions>({})
  const previousOrderRef = useRef<PreviousOrder>({})
  const previousInputRef = useRef<LayoutInput>({ entities: [], edges: [] })

  const onNodeClickRef = useRef(onNodeClick)
  const onEdgeClickRef = useRef(onEdgeClick)
  const resolvedLayout = useMemo(
    () => resolveLayoutWithFallback(layoutEngineMode, { entities, edges }, layoutConfig),
    [layoutEngineMode, entities, edges, layoutConfig]
  )
  const layoutOutput = resolvedLayout.output
  const layoutEdgeById = useMemo(
    () => new Map(layoutOutput.edges.map((edge) => [edge.id, edge])),
    [layoutOutput.edges]
  )

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

  useEffect(() => {
    onEdgeClickRef.current = onEdgeClick
  }, [onEdgeClick])

  const elements = useMemo<ElementDefinition[]>(() => {
    const nodeElements: ElementDefinition[] = entities.map((entity) => ({
      data: {
        id: entity.id,
        label: resolveNodeLabel(entity),
        entityKind: entity.entity_kind,
        isSelected: entity.id === selectedEntityId ? "true" : "false"
      }
    }))

    const edgeElements: ElementDefinition[] = edges.map((edge) => {
      const layoutEdge = layoutEdgeById.get(edge.id)
      const path =
        layoutEdge && layoutEdge.path && typeof layoutEdge.path === "object"
          ? (layoutEdge.path as Record<string, unknown>)
          : null
      const routingStyle =
        path?.kind === "orthogonal_horizontal"
          ? "orthogonal-horizontal"
          : path?.kind === "orthogonal"
            ? "orthogonal"
            : "default"

      return {
        data: {
          id: edge.id,
          source: edge.from_entity_id,
          target: edge.to_entity_id,
          relationshipType: edge.relationship_type,
          relationshipGroup: normalizeRelationshipTypeCode(edge.relationship_type),
          line_color: colorForRelationshipType(edge.relationship_type),
          active: edge.active ? "true" : "false",
          routingStyle
        }
      }
    })

    return [...nodeElements, ...edgeElements]
  }, [entities, edges, selectedEntityId, layoutEdgeById])

  const topologyKey = useMemo(() => {
    const nodeIds = [...entities.map((entity) => entity.id)].sort().join(",")
    const edgeIds = [...edges.map((edge) => edge.id)].sort().join(",")
    return `${nodeIds}|${edgeIds}`
  }, [entities, edges])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const resolvedTheme = resolveGraphTheme(containerRef.current)
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: buildCanvasStyles(resolvedTheme, false, false) as never,
      layout: {
        name: "grid",
        animate: false,
        fit: true,
        padding: 24
      },
      userZoomingEnabled: true,
      minZoom: 0.2,
      maxZoom: 2
    })
    cyRef.current = cy

    const handleTap = (event: cytoscape.EventObject) => {
      const id = event.target.id()
      if (id) {
        onNodeClickRef.current(id)
      }
    }

    const handleEdgeTap = (event: cytoscape.EventObject) => {
      const id = event.target.id()
      if (id) {
        onEdgeClickRef.current?.(id)
      }
    }

    cy.on("tap", "node", handleTap)
    cy.on("tap", "edge", handleEdgeTap)

    return () => {
      cy.off("tap", "node", handleTap)
      cy.off("tap", "edge", handleEdgeTap)
      cy.stop()
      cy.destroy()
      cyRef.current = null
      previousTopologyKeyRef.current = ""
      previousPositionsRef.current = {}
      previousOrderRef.current = {}
      previousInputRef.current = { entities: [], edges: [] }
    }
  }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) {
      return
    }

    const themeSource = containerRef.current
    if (!themeSource) {
      return
    }

    const resolvedTheme = resolveGraphTheme(themeSource)
    cy.style(buildCanvasStyles(resolvedTheme, showNodeLabels, showRelationshipLabels) as never)
  }, [showNodeLabels, showRelationshipLabels])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) {
      return
    }

    const nextElementById = new Map(elements.map((element) => [String(element.data?.id ?? ""), element]))

    cy.batch(() => {
      for (const existingElement of cy.elements().toArray()) {
        if (!nextElementById.has(existingElement.id())) {
          existingElement.remove()
        }
      }

      const nodeElements = elements.filter((element) => {
        const data = element.data as Record<string, unknown> | undefined
        return data ? !("source" in data) : false
      })
      const edgeElements = elements.filter((element) => {
        const data = element.data as Record<string, unknown> | undefined
        return data ? "source" in data : false
      })

      for (const element of nodeElements) {
        const elementId = String(element.data?.id ?? "")
        if (!elementId) {
          continue
        }

        const existing = cy.getElementById(elementId)
        if (existing.length > 0) {
          existing.data(element.data ?? {})
        } else {
          cy.add(element)
        }
      }

      for (const element of edgeElements) {
        const elementId = String(element.data?.id ?? "")
        if (!elementId) {
          continue
        }

        const edgeData = (element.data ?? {}) as Record<string, unknown>
        const sourceId = typeof edgeData.source === "string" ? edgeData.source : ""
        const targetId = typeof edgeData.target === "string" ? edgeData.target : ""
        if (!sourceId || !targetId) {
          continue
        }

        // Guard against partial graph payloads where an edge arrives before one endpoint.
        if (cy.getElementById(sourceId).length === 0 || cy.getElementById(targetId).length === 0) {
          const dangling = cy.getElementById(elementId)
          if (dangling.length > 0) {
            dangling.remove()
          }
          continue
        }

        const existing = cy.getElementById(elementId)
        if (existing.length > 0) {
          existing.data(edgeData)
        } else {
          cy.add(element)
        }
      }
    })

    const topologyChanged = previousTopologyKeyRef.current !== topologyKey
    const modeChanged = previousLayoutModeRef.current !== layoutMode
    const layoutEngineChanged = previousLayoutEngineModeRef.current !== layoutEngineMode
    const layoutConfigKey = `${layoutConfig.horizontalSpacing}|${layoutConfig.verticalSpacing}`
    const layoutConfigChanged = previousLayoutConfigKeyRef.current !== layoutConfigKey

    const previousInput = previousInputRef.current
    const previousNodeIds = new Set(previousInput.entities.map((entity) => entity.id))
    const currentNodeIds = new Set(entities.map((entity) => entity.id))
    const previousEdgeIds = new Set(previousInput.edges.map((edge) => edge.id))
    const currentEdgeIds = new Set(edges.map((edge) => edge.id))
    const sharedNodeCount = [...currentNodeIds].filter((id) => previousNodeIds.has(id)).length
    const nodeUnionCount = new Set([...previousNodeIds, ...currentNodeIds]).size
    const sharedRatio = nodeUnionCount === 0 ? 1 : sharedNodeCount / nodeUnionCount
    const addedNodeIds = [...currentNodeIds].filter((id) => !previousNodeIds.has(id))
    const removedNodeIds = [...previousNodeIds].filter((id) => !currentNodeIds.has(id))
    const addedEdgeIds = [...currentEdgeIds].filter((id) => !previousEdgeIds.has(id))
    const removedEdgeIds = [...previousEdgeIds].filter((id) => !currentEdgeIds.has(id))

    let changeType: LayoutChangeType = "selection_only"
    if (!topologyChanged) {
      changeType = "selection_only"
    } else if (modeChanged || layoutEngineChanged || layoutConfigChanged) {
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

    if (layoutMode === "auto") {
      cy.autoungrabify(true)
      if (topologyChanged || modeChanged || layoutEngineChanged || layoutConfigChanged) {
        const input: LayoutInput = { entities, edges }
        const outputToApply =
          layoutEngineMode === "family_tree" && topologyChanged && changeType !== "global_change"
            ? applyIncrementalFamilyTreeLayout(input, {
                baseOutput: layoutOutput,
                previousPositions: previousPositionsRef.current,
                previousOrder: previousOrderRef.current,
                previousInput,
                changeType: changeType === "local_remove" ? "local_remove" : "local_add",
                addedNodeIds,
                removedNodeIds,
                addedEdgeIds,
                removedEdgeIds,
                config: layoutConfig
              }).output
            : layoutEngineMode === "family_tree" && topologyChanged
              ? applyFamilyTreeMinimalMovement(input, layoutOutput, previousPositionsRef.current, layoutConfig)
              : layoutOutput

        const nextPositions = Object.fromEntries(
          outputToApply.nodes.map((node) => [node.id, { x: node.x, y: node.y }])
        )
        const nextOrder = deriveFamilyOrderFromLayout(input, outputToApply)
        const newNodeInitialPositions =
          changeType === "local_add"
            ? Object.fromEntries(
                addedNodeIds.map((nodeId) => {
                  const neighborEdge =
                    edges.find((edge) => edge.to_entity_id === nodeId) ??
                    edges.find((edge) => edge.from_entity_id === nodeId)
                  const anchorId =
                    neighborEdge?.from_entity_id === nodeId
                      ? neighborEdge.to_entity_id
                      : neighborEdge?.from_entity_id ?? nodeId
                  const anchor = previousPositionsRef.current[anchorId] ?? nextPositions[nodeId]
                  return [nodeId, anchor]
                })
              )
            : undefined

        applyLayoutOutput(cy, outputToApply, {
          animate: !layoutConfigChanged,
          durationMs: changeType === "global_change" ? 260 : 190,
          newNodeInitialPositions
        })
        previousPositionsRef.current = nextPositions
        previousOrderRef.current = nextOrder
      }
    } else {
      cy.autoungrabify(false)
      if (topologyChanged) {
        cy.layout({ name: "cose", animate: false, fit: true, padding: 24 }).run()
      }
    }

    if (topologyChanged) {
      previousTopologyKeyRef.current = topologyKey
    }
    previousLayoutModeRef.current = layoutMode
    previousLayoutEngineModeRef.current = layoutEngineMode
    previousLayoutConfigKeyRef.current = layoutConfigKey
    previousInputRef.current = { entities, edges }
  }, [elements, topologyKey, layoutOutput, layoutMode, layoutEngineMode, layoutConfig, entities, edges])

  return (
    <div ref={canvasShellRef} className="relative h-[68vh] min-h-[520px] w-full overflow-hidden rounded-xl border border-[var(--graph-canvas-border)]">
      <div
        ref={containerRef}
        className="h-full w-full rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${graphTheme.canvas.bgFrom}, ${graphTheme.canvas.bgTo})`
        }}
      />
    </div>
  )
}
