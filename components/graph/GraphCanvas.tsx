"use client"

import cytoscape, { type ElementDefinition } from "cytoscape"
import { useEffect, useMemo, useRef } from "react"

import { deriveFamilyOrderFromLayout } from "@/lib/graph/layout/deriveFamilyOrder"
import type {
  LayoutConfig,
  LayoutInput,
  LayoutMode as LayoutEngineMode,
  LayoutOutput,
  PreviousOrder,
  PreviousPositions
} from "@/lib/graph/layout/types"
import { createDefaultLayoutConfig } from "@/lib/graph/layoutConfig"
import { layoutRegistry } from "@/lib/graph/layout/registry"
import { classifyLayoutChange } from "@/lib/graph/layoutUpdate"
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
    const defaultWidth = Number.parseFloat(String(node.style("width")))
    const defaultHeight = Number.parseFloat(String(node.style("height")))
    const targetWidth = Number.isFinite(defaultWidth) ? defaultWidth : 26
    const targetHeight = Number.isFinite(defaultHeight) ? defaultHeight : 26
    if (initial) {
      node.position({ x: initial.x, y: initial.y })
      node.style("opacity", 0.2)
      node.style("width", Math.max(8, targetWidth * 0.8))
      node.style("height", Math.max(8, targetHeight * 0.8))
    }
    node.animate(
      {
        position: {
          x: positionedNode.x,
          y: positionedNode.y
        },
        style: initial
          ? {
              opacity: 1,
              width: targetWidth,
              height: targetHeight
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
  return entity.display_name
}

export default function GraphCanvas({
  entities,
  edges,
  layoutMode = "auto",
  layoutEngineMode = "graph",
  layoutConfig = createDefaultLayoutConfig(),
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
  const previousLayoutConfigRef = useRef<LayoutConfig>(layoutConfig)
  const previousPositionsRef = useRef<PreviousPositions>({})
  const previousOrderRef = useRef<PreviousOrder>({})
  const previousInputRef = useRef<LayoutInput>({ entities: [], edges: [] })

  const onNodeClickRef = useRef(onNodeClick)
  const onEdgeClickRef = useRef(onEdgeClick)
  const layoutConfigForEngine = useMemo(
    () => ({
      ...layoutConfig,
      focusNodeId: selectedEntityId ?? null
    }),
    [layoutConfig, selectedEntityId]
  )
  const layoutOutput = useMemo(() => {
    const layout = layoutRegistry[layoutEngineMode]
    return layout({
      entities,
      edges,
      focusNodeId: selectedEntityId ?? undefined,
      previousPositions: previousPositionsRef.current,
      previousOrder: previousOrderRef.current,
      layoutConfig: layoutConfigForEngine
    })
  }, [layoutEngineMode, entities, edges, selectedEntityId, layoutConfigForEngine])
  const layoutEdgeById = useMemo(
    () => new Map(layoutOutput.edges.map((edge) => [edge.id, edge])),
    [layoutOutput.edges]
  )
  const layoutNodeById = useMemo(
    () => new Map(layoutOutput.nodes.map((node) => [node.id, node])),
    [layoutOutput.nodes]
  )

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

  useEffect(() => {
    onEdgeClickRef.current = onEdgeClick
  }, [onEdgeClick])

  const elements = useMemo<ElementDefinition[]>(() => {
    const nodeElements: ElementDefinition[] = entities.map((entity) => {
      const positionedNode = layoutNodeById.get(entity.id)
      return {
        data: {
          id: entity.id,
          label: resolveNodeLabel(entity),
          entityKind: entity.entity_kind,
          isSelected: entity.id === selectedEntityId ? "true" : "false"
        },
        position: positionedNode
          ? {
              x: positionedNode.x,
              y: positionedNode.y
            }
          : undefined
      }
    })

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
  }, [entities, edges, selectedEntityId, layoutEdgeById, layoutNodeById])

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
    const removalDurationMs = 180
    const exitingElementIds = cy
      .elements()
      .toArray()
      .map((element) => element.id())
      .filter((id) => !nextElementById.has(id))

    cy.batch(() => {
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
          existing.stop()
          existing.style("opacity", 1)
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
          existing.stop()
          existing.style("opacity", 1)
          existing.data(edgeData)
        } else {
          const added = cy.add(element)
          added.style("opacity", 0)
          added.animate(
            {
              style: { opacity: 1 }
            },
            {
              duration: removalDurationMs,
              easing: "ease-in-out"
            }
          )
        }
      }
    })

    for (const exitingId of exitingElementIds) {
      const element = cy.getElementById(exitingId)
      if (element.length === 0) {
        continue
      }
      element.stop()
      element.animate(
        {
          style: { opacity: 0 }
        },
        {
          duration: removalDurationMs,
          easing: "ease-in-out",
          complete: () => {
            const latest = cy.getElementById(exitingId)
            if (latest.length > 0 && !nextElementById.has(exitingId)) {
              latest.remove()
            }
          }
        }
      )
    }

    const topologyChanged = previousTopologyKeyRef.current !== topologyKey
    const modeChanged = previousLayoutModeRef.current !== layoutMode
    const layoutEngineChanged = previousLayoutEngineModeRef.current !== layoutEngineMode
    const layoutConfigKey = `${layoutConfig.horizontalSpacing}|${layoutConfig.verticalSpacing}`
    const layoutConfigChanged = previousLayoutConfigKeyRef.current !== layoutConfigKey

    const previousInput = previousInputRef.current
    const { changeType, addedNodeIds, removedNodeIds, addedEdgeIds, removedEdgeIds } = classifyLayoutChange({
      previousEntities: previousInput.entities,
      previousEdges: previousInput.edges,
      entities,
      edges,
      topologyChanged,
      modeChanged,
      layoutEngineChanged,
      layoutConfigChanged
    })

    if (layoutMode === "auto") {
      cy.autoungrabify(true)
      if (topologyChanged || modeChanged || layoutEngineChanged || layoutConfigChanged) {
        const input: LayoutInput = { entities, edges }
        const outputToApply = layoutOutput
        const requiresViewportReset =
          previousTopologyKeyRef.current === "" || modeChanged || layoutEngineChanged

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
          animate: !layoutConfigChanged && !requiresViewportReset,
          durationMs: changeType === "global_change" ? 260 : 190,
          newNodeInitialPositions
        })
        if (requiresViewportReset && cy.nodes().length > 0) {
          cy.fit(cy.nodes(), 24)
        }
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
    previousLayoutConfigRef.current = layoutConfig
    previousInputRef.current = { entities, edges }
  }, [elements, topologyKey, layoutOutput, layoutMode, layoutEngineMode, layoutConfig, layoutConfigForEngine, entities, edges])

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
