"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { FormEvent, useMemo, useState } from "react"

import { createGraphEntity, fetchGraphEntities } from "@/lib/api/graphs"
import GraphExplorer from "@/components/graph/GraphExplorer"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import Input from "@/components/ui/Input"
import SectionHeader from "@/components/ui/SectionHeader"
import Select from "@/components/ui/Select"
import { buttonStyles } from "@/lib/ui/styles"

type GraphWorkspaceProps = {
  graphId: string
  graphName: string
  initialAsOf: string
}

export default function GraphWorkspace({ graphId, graphName, initialAsOf }: GraphWorkspaceProps) {
  const [newEntityName, setNewEntityName] = useState("")
  const [newEntityKind, setNewEntityKind] = useState<"person" | "animal" | "place">("person")
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null)
  const [showManager, setShowManager] = useState(false)
  const queryClient = useQueryClient()

  const entitiesQuery = useQuery({
    queryKey: ["graph:entities", graphId],
    queryFn: () => fetchGraphEntities(graphId)
  })

  const createEntityMutation = useMutation({
    mutationFn: async () =>
      createGraphEntity(graphId, {
        entity_kind: newEntityKind,
        display_name: newEntityName.trim()
      }),
    onSuccess: (entity) => {
      setNewEntityName("")
      setSelectedOverride(entity.id)
      queryClient.invalidateQueries({ queryKey: ["graph:entities", graphId] })
    }
  })

  const entities = useMemo(() => entitiesQuery.data ?? [], [entitiesQuery.data])
  const selectedEntityId = useMemo(() => {
    if (!selectedOverride) {
      return entities[0]?.id ?? null
    }

    return entities.some((entity) => entity.id === selectedOverride)
      ? selectedOverride
      : (entities[0]?.id ?? null)
  }, [entities, selectedOverride])

  function onCreateEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newEntityName.trim()) {
      return
    }

    createEntityMutation.mutate()
  }

  return (
    <main className="console-atmosphere relative min-h-screen overflow-hidden bg-[var(--console-bg)] px-5 py-8 md:px-8 md:py-10">
      <div className="console-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
      <section className="relative z-10 mx-auto w-full max-w-[1200px]">
        <Card as="header" className="fade-in mb-5 p-5 shadow-[var(--console-shadow-strong)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--console-success)]">Graph Workspace</p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--console-text-strong)]">{graphName}</h1>
              <p className="mt-1 text-sm text-[var(--console-text-dim)]">Explore connections and expand from selected nodes.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                block
                className="sm:w-auto"
                onClick={() => setShowManager((previous) => !previous)}
              >
                {showManager ? "Hide controls" : "Manage graph"}
              </Button>
              <Link
                href="/graphs"
                className={buttonStyles({
                  variant: "ghost",
                  block: true,
                  className: "sm:w-auto"
                })}
              >
                Back to graphs
              </Link>
            </div>
          </div>
        </Card>

        {selectedEntityId ? (
          <GraphExplorer graphId={graphId} entityId={selectedEntityId} initialAsOf={initialAsOf} />
        ) : (
          <Card className="stagger-2 fade-in mb-5 border-dashed p-8 text-center text-sm text-[var(--console-text-dim)]">
            No entities yet. Create your first entity to start this graph.
          </Card>
        )}

        {(showManager || !selectedEntityId) ? (
          <Card className="stagger-1 fade-in mt-5 grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr]">
            <Card as="form" variant="subpanel" onSubmit={onCreateEntity} className="space-y-3 p-4">
              <SectionHeader>Create Entity</SectionHeader>
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--console-text-muted)]">Name</span>
                <Input
                  value={newEntityName}
                  onChange={(event) => setNewEntityName(event.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--console-text-muted)]">Kind</span>
                <Select
                  value={newEntityKind}
                  onChange={(event) => setNewEntityKind(event.target.value as "person" | "animal" | "place")}
                >
                  <option value="person">person</option>
                  <option value="animal">animal</option>
                  <option value="place">place</option>
                </Select>
              </label>
              <Button
                type="submit"
                disabled={createEntityMutation.isPending}
                variant="primary"
                className="tracking-[0.14em]"
              >
                {createEntityMutation.isPending ? "Creating..." : "Create entity"}
              </Button>
              {createEntityMutation.error ? (
                <Card variant="danger" className="p-3 text-sm">
                  {(createEntityMutation.error as Error).message}
                </Card>
              ) : null}
            </Card>

            <Card variant="subpanel" className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <SectionHeader>Focus Entity</SectionHeader>
                <Badge>{entities.length} total</Badge>
              </div>
              {entitiesQuery.isLoading ? (
                <Card variant="subpanel" className="mt-2 p-2 text-sm text-[var(--console-text-dim)]">
                  Loading entities...
                </Card>
              ) : null}
              {entitiesQuery.error ? (
                <Card variant="danger" className="mt-2 p-2 text-sm">
                  {(entitiesQuery.error as Error).message}
                </Card>
              ) : null}
              <Select
                value={selectedEntityId ?? ""}
                onChange={(event) => setSelectedOverride(event.target.value || null)}
                className="mt-2"
                disabled={entities.length === 0}
              >
                {entities.length === 0 ? <option value="">No entities available</option> : null}
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.display_name} ({entity.entity_kind})
                  </option>
                ))}
              </Select>
              <p className="mt-3 text-xs text-[var(--console-text-dim)]">
                Choose which entity the graph view should center on.
              </p>
            </Card>
          </Card>
        ) : null}
      </section>
    </main>
  )
}
