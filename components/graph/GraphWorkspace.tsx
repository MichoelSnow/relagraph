"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { FormEvent, useMemo, useState } from "react"

import { createGraphEntity, fetchGraphEntities } from "@/lib/api/graphs"
import GraphExplorer from "@/components/graph/GraphExplorer"

type GraphWorkspaceProps = {
  graphId: string
  graphName: string
  initialAsOf: string
}

export default function GraphWorkspace({ graphId, graphName, initialAsOf }: GraphWorkspaceProps) {
  const [newEntityName, setNewEntityName] = useState("")
  const [newEntityKind, setNewEntityKind] = useState<"person" | "animal" | "place">("person")
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null)
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
    <main className="mx-auto min-h-screen w-full max-w-7xl p-4">
      <header className="mb-4 flex items-center justify-between rounded-md border border-slate-300 bg-white p-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{graphName}</h1>
          <p className="text-sm text-slate-600">Graph ID: {graphId}</p>
        </div>
        <Link href="/graphs" className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700">
          Back to graphs
        </Link>
      </header>

      <section className="mb-4 grid gap-4 rounded-md border border-slate-300 bg-white p-4 lg:grid-cols-[1fr_1fr]">
        <form onSubmit={onCreateEntity} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Create Entity</h2>
          <label className="block text-sm text-slate-700">
            Name
            <input
              value={newEntityName}
              onChange={(event) => setNewEntityName(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm text-slate-700">
            Kind
            <select
              value={newEntityKind}
              onChange={(event) => setNewEntityKind(event.target.value as "person" | "animal" | "place")}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            >
              <option value="person">person</option>
              <option value="animal">animal</option>
              <option value="place">place</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={createEntityMutation.isPending}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {createEntityMutation.isPending ? "Creating..." : "Create entity"}
          </button>
          {createEntityMutation.error ? (
            <p className="text-sm text-rose-700">{(createEntityMutation.error as Error).message}</p>
          ) : null}
        </form>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">Center Entity</h2>
          {entitiesQuery.isLoading ? <p className="mt-2 text-sm text-slate-600">Loading...</p> : null}
          {entitiesQuery.error ? (
            <p className="mt-2 text-sm text-rose-700">{(entitiesQuery.error as Error).message}</p>
          ) : null}
          <select
            value={selectedEntityId ?? ""}
            onChange={(event) => setSelectedOverride(event.target.value || null)}
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
            disabled={entities.length === 0}
          >
            {entities.length === 0 ? <option value="">No entities available</option> : null}
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.display_name} ({entity.entity_kind})
              </option>
            ))}
          </select>
        </div>
      </section>

      {selectedEntityId ? (
        <GraphExplorer graphId={graphId} entityId={selectedEntityId} initialAsOf={initialAsOf} />
      ) : (
        <section className="rounded-md border border-slate-300 bg-white p-6 text-sm text-slate-600">
          Create at least one entity to render this graph.
        </section>
      )}
    </main>
  )
}
