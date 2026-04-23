"use client"

import cytoscape, { type ElementDefinition } from "cytoscape"
import { useEffect, useMemo, useRef } from "react"

import type { Edge, Entity } from "@/types"
import { computeNodeLevels } from "@/lib/graph/layoutLevels"
import { normalizeRelationshipTypeCode } from "@/lib/graph/relationshipType"
import { graphTheme, resolveGraphTheme, type ResolvedGraphTheme } from "@/lib/ui/graphTheme"

type GraphCanvasProps = {
  entities: Entity[]
  edges: Edge[]
  layoutMode?: "auto" | "manual"
  selectedEntityId?: string | null
  showNodeLabels?: boolean
  showRelationshipLabels?: boolean
  onNodeClick: (entityId: string) => void
  onEdgeClick?: (relationshipId: string) => void
  onAddLinkedNodeFrom?: (node: { entityId: string; entityKind: Entity["entity_kind"] }) => void
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

function runAutoLevelLayout(cy: cytoscape.Core, entities: Entity[], edges: Edge[]) {
  const levels = computeNodeLevels(entities, edges)
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]))
  const idsByLevel = new Map<number, string[]>()

  for (const entity of entities) {
    const level = levels.get(entity.id) ?? 0
    const ids = idsByLevel.get(level) ?? []
    ids.push(entity.id)
    idsByLevel.set(level, ids)
  }

  const levelOrder = [...idsByLevel.keys()].sort((a, b) => a - b)
  for (const level of levelOrder) {
    const ids = idsByLevel.get(level) ?? []
    ids.sort((a, b) => {
      const aLabel = entitiesById.get(a)?.display_name ?? a
      const bLabel = entitiesById.get(b)?.display_name ?? b
      return aLabel.localeCompare(bLabel)
    })
  }

  const verticalSpacing = 180
  const horizontalSpacing = 180

  for (const level of levelOrder) {
    const ids = idsByLevel.get(level) ?? []
    const centerOffset = (ids.length - 1) / 2
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index]
      const node = cy.getElementById(id)
      if (node.length === 0) {
        continue
      }
      node.animate(
        {
          position: {
            x: (index - centerOffset) * horizontalSpacing,
            y: level * verticalSpacing
          }
        },
        {
          duration: 220,
          easing: "ease-in-out"
        }
      )
    }
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
  selectedEntityId,
  showNodeLabels = true,
  showRelationshipLabels = false,
  onNodeClick,
  onEdgeClick,
  onAddLinkedNodeFrom
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasShellRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const floatingLayerRef = useRef<HTMLDivElement | null>(null)
  const previousTopologyKeyRef = useRef("")
  const previousLayoutModeRef = useRef<"auto" | "manual">(layoutMode)
  const renderNodeAddButtonsRef = useRef<(() => void) | null>(null)

  const onNodeClickRef = useRef(onNodeClick)
  const onEdgeClickRef = useRef(onEdgeClick)
  const onAddLinkedNodeFromRef = useRef(onAddLinkedNodeFrom)

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

  useEffect(() => {
    onEdgeClickRef.current = onEdgeClick
  }, [onEdgeClick])

  useEffect(() => {
    onAddLinkedNodeFromRef.current = onAddLinkedNodeFrom
  }, [onAddLinkedNodeFrom])

  const elements = useMemo<ElementDefinition[]>(() => {
    const nodeElements: ElementDefinition[] = entities.map((entity) => ({
      data: {
        id: entity.id,
        label: resolveNodeLabel(entity),
        entityKind: entity.entity_kind,
        isSelected: entity.id === selectedEntityId ? "true" : "false"
      }
    }))

    const edgeElements: ElementDefinition[] = edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.from_entity_id,
        target: edge.to_entity_id,
        relationshipType: edge.relationship_type,
        relationshipGroup: normalizeRelationshipTypeCode(edge.relationship_type),
        line_color: colorForRelationshipType(edge.relationship_type),
        active: edge.active ? "true" : "false"
      }
    }))

    return [...nodeElements, ...edgeElements]
  }, [entities, edges, selectedEntityId])

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

    const shell = canvasShellRef.current ?? containerRef.current
    if (!shell) {
      cy.destroy()
      cyRef.current = null
      return
    }

    const floatingLayer = document.createElement("div")
    floatingLayer.style.position = "absolute"
    floatingLayer.style.left = "0"
    floatingLayer.style.top = "0"
    floatingLayer.style.width = "100%"
    floatingLayer.style.height = "100%"
    floatingLayer.style.pointerEvents = "none"
    floatingLayer.style.zIndex = "2"
    shell.appendChild(floatingLayer)
    floatingLayerRef.current = floatingLayer

    const renderNodeAddButtons = () => {
      const currentCy = cyRef.current
      const currentLayer = floatingLayerRef.current
      const containerElement = containerRef.current
      if (!currentCy || !currentLayer || !containerElement) {
        return
      }

      const containerWidth = containerElement.clientWidth
      const containerHeight = containerElement.clientHeight
      currentLayer.innerHTML = ""
      for (const node of currentCy.nodes()) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "absolute inline-flex items-center justify-center rounded-full font-semibold"
        button.textContent = "+"
        button.setAttribute("aria-label", "Add linked node")

        const position = node.renderedPosition()
        const renderedX = position.x
        const renderedY = position.y
        if (!Number.isFinite(renderedX) || !Number.isFinite(renderedY)) {
          continue
        }
        if (
          renderedX < -64 ||
          renderedY < -64 ||
          renderedX > containerWidth + 64 ||
          renderedY > containerHeight + 64
        ) {
          continue
        }

        const renderedNodeSize = Math.max(node.renderedWidth(), node.renderedHeight())
        const buttonSize = Math.max(14, Math.min(30, renderedNodeSize * 0.9))
        const offset = renderedNodeSize * 0.55

        button.style.left = `${renderedX + offset}px`
        button.style.top = `${renderedY - offset}px`
        button.style.transform = "translate(-50%, -50%)"
        button.style.height = `${buttonSize}px`
        button.style.width = `${buttonSize}px`
        button.style.background = "#22c55e"
        button.style.color = "#0b1020"
        button.style.border = "2px solid #0b1020"
        button.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.35)"
        button.style.fontSize = `${Math.max(10, Math.min(18, buttonSize * 0.65))}px`
        button.style.lineHeight = "1"
        button.style.pointerEvents = "auto"
        button.onwheel = (event) => {
          event.preventDefault()
          event.stopPropagation()

          const container = containerRef.current
          if (!container) {
            return
          }

          const forwardedEvent = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaMode: event.deltaMode,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaZ: event.deltaZ,
            clientX: event.clientX,
            clientY: event.clientY,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey
          })
          container.dispatchEvent(forwardedEvent)
        }
        button.onclick = (event) => {
          event.preventDefault()
          event.stopPropagation()
          onAddLinkedNodeFromRef.current?.({
            entityId: node.id(),
            entityKind: (node.data("entityKind") as Entity["entity_kind"]) ?? "person"
          })
        }
        currentLayer.appendChild(button)
      }
    }

    renderNodeAddButtonsRef.current = renderNodeAddButtons

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
    cy.on("render zoom pan resize layoutstop", renderNodeAddButtons)
    window.addEventListener("resize", renderNodeAddButtons)
    renderNodeAddButtons()
    requestAnimationFrame(renderNodeAddButtons)

    return () => {
      cy.off("tap", "node", handleTap)
      cy.off("tap", "edge", handleEdgeTap)
      cy.off("render zoom pan resize layoutstop", renderNodeAddButtons)
      window.removeEventListener("resize", renderNodeAddButtons)
      cy.stop()
      cy.destroy()
      cyRef.current = null
      previousTopologyKeyRef.current = ""
      renderNodeAddButtonsRef.current = null

      floatingLayer.remove()
      floatingLayerRef.current = null
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
    renderNodeAddButtonsRef.current?.()
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

    if (layoutMode === "auto") {
      cy.autoungrabify(true)
      if (topologyChanged || modeChanged) {
        runAutoLevelLayout(cy, entities, edges)
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

    renderNodeAddButtonsRef.current?.()
  }, [elements, topologyKey, entities, edges, layoutMode])

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
