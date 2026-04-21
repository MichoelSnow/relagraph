"use client"

import cytoscape, { type ElementDefinition } from "cytoscape"
import { useEffect, useMemo, useRef } from "react"

import type { Edge, Entity } from "@/types"
import { graphTheme, resolveGraphTheme } from "@/lib/ui/graphTheme"

type GraphCanvasProps = {
  entities: Entity[]
  edges: Edge[]
  selectedEntityId?: string | null
  showNodeLabels?: boolean
  showRelationshipLabels?: boolean
  onNodeClick: (entityId: string) => void
  onEdgeClick?: (relationshipId: string) => void
  onAddLinkedNodeFrom?: (entityId: string) => void
}

export default function GraphCanvas({
  entities,
  edges,
  selectedEntityId,
  showNodeLabels = true,
  showRelationshipLabels = false,
  onNodeClick,
  onEdgeClick,
  onAddLinkedNodeFrom
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
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
        label: entity.display_name,
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
        active: edge.active ? "true" : "false"
      }
    }))

    return [...nodeElements, ...edgeElements]
  }, [entities, edges, selectedEntityId])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const resolvedTheme = resolveGraphTheme(containerRef.current)

    const hasSingleNode = entities.length <= 1

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
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
            "target-arrow-color": resolvedTheme.edge.line,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier"
          }
        },
        {
          selector: 'edge[active = "false"]',
          style: {
            opacity: 0.45,
            "line-style": "dashed"
          }
        }
      ],
      layout: {
        name: hasSingleNode ? "grid" : "cose",
        animate: false,
        fit: !hasSingleNode,
        padding: 24
      },
      userZoomingEnabled: true,
      minZoom: 0.2,
      maxZoom: 2
    })

    if (hasSingleNode) {
      cy.zoom(1)
      cy.center()
    }

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

    const floatingLayer = document.createElement("div")
    floatingLayer.style.position = "fixed"
    floatingLayer.style.left = "0"
    floatingLayer.style.top = "0"
    floatingLayer.style.width = "100vw"
    floatingLayer.style.height = "100vh"
    floatingLayer.style.pointerEvents = "none"
    floatingLayer.style.zIndex = "9999"
    document.body.appendChild(floatingLayer)

    const renderNodeAddButtons = () => {
      floatingLayer.innerHTML = ""
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) {
        return
      }

      for (const node of cy.nodes()) {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "fixed inline-flex items-center justify-center rounded-full font-semibold"
        button.textContent = "+"
        button.setAttribute("aria-label", "Add linked node")
        const position = node.renderedPosition()
        const renderedX = containerRect.left + position.x
        const renderedY = containerRect.top + position.y
        if (!Number.isFinite(renderedX) || !Number.isFinite(renderedY)) {
          continue
        }
        button.style.left = `${renderedX + 18}px`
        button.style.top = `${renderedY - 18}px`
        button.style.transform = "translate(-50%, -50%)"
        button.style.height = "24px"
        button.style.width = "24px"
        button.style.background = "#22c55e"
        button.style.color = "#0b1020"
        button.style.border = "2px solid #0b1020"
        button.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.35)"
        button.style.fontSize = "16px"
        button.style.lineHeight = "1"
        button.style.pointerEvents = "auto"
        button.onclick = (event) => {
          event.preventDefault()
          event.stopPropagation()
          onAddLinkedNodeFromRef.current?.(node.id())
        }
        floatingLayer.appendChild(button)
      }
    }

    cy.on("tap", "node", handleTap)
    cy.on("tap", "edge", handleEdgeTap)
    cy.on("render zoom pan resize layoutstop", renderNodeAddButtons)
    window.addEventListener("resize", renderNodeAddButtons)
    window.addEventListener("scroll", renderNodeAddButtons, true)
    renderNodeAddButtons()
    requestAnimationFrame(renderNodeAddButtons)

    return () => {
      cy.off("tap", "node", handleTap)
      cy.off("tap", "edge", handleEdgeTap)
      cy.off("render zoom pan resize layoutstop", renderNodeAddButtons)
      window.removeEventListener("resize", renderNodeAddButtons)
      window.removeEventListener("scroll", renderNodeAddButtons, true)
      cy.stop()
      cy.destroy()
      floatingLayer.remove()
    }
  }, [elements, entities.length, showNodeLabels, showRelationshipLabels])

  return (
    <div className="relative h-[68vh] min-h-[520px] w-full rounded-xl border border-[var(--graph-canvas-border)]">
      <div
        ref={containerRef}
        className="h-full w-full rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${graphTheme.canvas.bgFrom}, ${graphTheme.canvas.bgTo})`
        }}
      />
      <div ref={overlayRef} className="absolute inset-0 z-50" />
    </div>
  )
}
