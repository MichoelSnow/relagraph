"use client"

import cytoscape, { type ElementDefinition } from "cytoscape"
import { useEffect, useMemo, useRef } from "react"

import type { Edge, Entity } from "@/types"

type GraphCanvasProps = {
  entities: Entity[]
  edges: Edge[]
  onNodeClick: (entityId: string) => void
}

export default function GraphCanvas({ entities, edges, onNodeClick }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const elements = useMemo<ElementDefinition[]>(() => {
    const nodeElements: ElementDefinition[] = entities.map((entity) => ({
      data: {
        id: entity.id,
        label: entity.display_name,
        entityKind: entity.entity_kind
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
  }, [entities, edges])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "#0f766e",
            color: "#0f172a",
            "text-valign": "bottom",
            "text-margin-y": 8,
            "font-size": 11,
            width: 22,
            height: 22
          }
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#64748b",
            "target-arrow-color": "#64748b",
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
      }
    })

    cy.on("tap", "node", (event) => {
      const id = event.target.id()
      if (id) {
        onNodeClick(id)
      }
    })

    return () => {
      cy.destroy()
    }
  }, [elements, onNodeClick])

  return <div ref={containerRef} className="h-[520px] w-full rounded-md border border-slate-300" />
}
