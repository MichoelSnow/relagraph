"use client"

import cytoscape, { type ElementDefinition } from "cytoscape"
import { useEffect, useMemo, useRef } from "react"

import type { Edge, Entity } from "@/types"
import { graphTheme, resolveGraphTheme } from "@/lib/ui/graphTheme"

type GraphCanvasProps = {
  entities: Entity[]
  edges: Edge[]
  selectedEntityId?: string | null
  onNodeClick: (entityId: string) => void
}

export default function GraphCanvas({
  entities,
  edges,
  selectedEntityId,
  onNodeClick
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onNodeClickRef = useRef(onNodeClick)

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

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
            label: "data(label)",
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
            label: "data(relationshipType)",
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
        name: "cose",
        animate: false,
        fit: true,
        padding: 24
      },
      userZoomingEnabled: true
    })

    const handleTap = (event: cytoscape.EventObject) => {
      const id = event.target.id()
      if (id) {
        onNodeClickRef.current(id)
      }
    }

    cy.on("tap", "node", handleTap)

    return () => {
      cy.off("tap", "node", handleTap)
      cy.stop()
      cy.destroy()
    }
  }, [elements])

  return (
    <div
      ref={containerRef}
      className="h-[68vh] min-h-[520px] w-full rounded-xl border border-[var(--graph-canvas-border)]"
      style={{
        background: `linear-gradient(135deg, ${graphTheme.canvas.bgFrom}, ${graphTheme.canvas.bgTo})`
      }}
    />
  )
}
