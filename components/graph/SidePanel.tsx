"use client"

import Badge from "@/components/ui/Badge"
import Card from "@/components/ui/Card"
import SectionHeader from "@/components/ui/SectionHeader"

type SidePanelProps = {
  selectedEntityId: string | null
  nodeCount: number
  edgeCount: number
}

export default function SidePanel({ selectedEntityId, nodeCount, edgeCount }: SidePanelProps) {
  return (
    <Card as="aside" className="fade-in p-4 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
      <SectionHeader className="text-[#6fe8ff]">Inspector</SectionHeader>
      <p className="mt-1 text-xs text-[var(--console-text-dim)]">
        Click a node to select it and expand nearby connections.
      </p>

      <dl className="mt-4 space-y-2 text-xs text-[var(--console-text)]">
        <div className="flex items-center justify-between gap-4">
          <dt>Nodes</dt>
          <dd><Badge>{nodeCount}</Badge></dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Edges</dt>
          <dd><Badge>{edgeCount}</Badge></dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Selection</dt>
          <dd><Badge variant={selectedEntityId ? "accent" : "default"}>{selectedEntityId ? "active" : "none"}</Badge></dd>
        </div>
      </dl>
    </Card>
  )
}
