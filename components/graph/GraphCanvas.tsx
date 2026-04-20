"use client"

import cytoscape, { type ElementDefinition } from "cytoscape"
import { useEffect, useMemo, useRef } from "react"

import type { Edge, Entity } from "@/types"
import { graphTheme } from "@/lib/ui/styles"

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
        isSelected: entity.id === selectedEntityId
      }
    }))

    const edgeElements: ElementDefinition[] = edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.from_entity_id,
        target: edge.to_entity_id,
        relationshipType: edge.relationship_type,
        active: edge.active
      }
    }))

    return [...nodeElements, ...edgeElements]
  }, [entities, edges, selectedEntityId])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node[entityKind = 'person']",
          style: {
            "background-color": graphTheme.node.person
          }
        },
        {
          selector: "node[entityKind = 'animal']",
          style: {
            "background-color": graphTheme.node.animal
          }
        },
        {
          selector: "node[entityKind = 'place']",
          style: {
            "background-color": graphTheme.node.place
          }
        },
        {
          selector: "node",
          style: {
            label: "data(label)",
            color: graphTheme.node.text,
            "text-valign": "bottom",
            "text-margin-y": 8,
            "font-size": 12,
            width: 26,
            height: 26,
            "border-width": 1.5,
            "border-color": graphTheme.node.border,
            "text-background-color": graphTheme.node.textBg,
            "text-background-opacity": 1,
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle"
          }
        },
        {
          selector: "node[isSelected = true]",
          style: {
            "border-width": 5,
            "border-color": graphTheme.node.selectedBorder
          }
        },
        {
          selector: "node:hover",
          style: {
            "overlay-color": graphTheme.node.hoverOverlay,
            "overlay-padding": 8,
            "overlay-opacity": 0.16
          }
        },
        {
          selector: "edge",
          style: {
            width: 2,
            label: "data(relationshipType)",
            color: graphTheme.edge.text,
            "font-size": 10,
            "text-background-color": graphTheme.edge.textBg,
            "text-background-opacity": 1,
            "text-background-padding": "2px",
            "line-color": graphTheme.edge.line,
            "target-arrow-color": graphTheme.edge.line,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier"
          }
        },
        {
          selector: "edge[active = false]",
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
      userZoomingEnabled: true,
      wheelSensitivity: 1
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
      className="h-[68vh] min-h-[520px] w-full rounded-xl border border-[var(--console-border)]"
      style={{
        background: `linear-gradient(135deg, ${graphTheme.canvas.bgFrom}, ${graphTheme.canvas.bgTo})`
      }}
    />
  )
}
