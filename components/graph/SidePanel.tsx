"use client"

type SidePanelProps = {
  selectedEntityId: string | null
  nodeCount: number
  edgeCount: number
}

export default function SidePanel({ selectedEntityId, nodeCount, edgeCount }: SidePanelProps) {
  return (
    <aside className="rounded-md border border-slate-300 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Side Panel</h2>
      <p className="mt-2 text-xs text-slate-600">Phase 7 placeholder.</p>
      <dl className="mt-4 space-y-2 text-xs text-slate-700">
        <div className="flex items-center justify-between gap-4">
          <dt>Nodes</dt>
          <dd>{nodeCount}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Edges</dt>
          <dd>{edgeCount}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Selected node</dt>
          <dd className="max-w-[140px] truncate">{selectedEntityId ?? "none"}</dd>
        </div>
      </dl>
    </aside>
  )
}
