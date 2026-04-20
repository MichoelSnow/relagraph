"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { FormEvent, useMemo, useState } from "react"

import { createGraphEntity, fetchGraphEntities } from "@/lib/api/graphs"
import GraphExplorer from "@/components/graph/GraphExplorer"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import FormContainer from "@/components/ui/FormContainer"
import Input from "@/components/ui/Input"
import PageHeader from "@/components/ui/PageHeader"
import PageLayout from "@/components/ui/PageLayout"
import Section from "@/components/ui/Section"
import Select from "@/components/ui/Select"
import Stack from "@/components/ui/Stack"

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
    <PageLayout>
      <PageHeader
        title={graphName}
        description="Explore connections and expand from selected nodes."
        action={(
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowManager((previous) => !previous)}
            >
              {showManager ? "Hide controls" : "Manage graph"}
            </Button>
            <Link
              href="/graphs"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Back to graphs
            </Link>
          </div>
        )}
      />

      <Section title="Controls">
        <Stack className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{entities.length} entities</Badge>
            <FormContainer>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Focus entity</span>
                <Select
                  value={selectedEntityId ?? ""}
                  onChange={(event) => setSelectedOverride(event.target.value || null)}
                  disabled={entities.length === 0}
                >
                  {entities.length === 0 ? <option value="">No entities available</option> : null}
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.display_name} ({entity.entity_kind})
                    </option>
                  ))}
                </Select>
              </label>
            </FormContainer>
          </div>

          {(showManager || !selectedEntityId) ? (
            <FormContainer>
              <form onSubmit={onCreateEntity}>
                <Stack className="gap-3">
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">New entity name</span>
                    <Input
                      value={newEntityName}
                      onChange={(event) => setNewEntityName(event.target.value)}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Entity type</span>
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
                  >
                    {createEntityMutation.isPending ? "Creating..." : "Create entity"}
                  </Button>
                  {createEntityMutation.error ? (
                    <Card variant="danger" className="p-3 text-sm">
                      {(createEntityMutation.error as Error).message}
                    </Card>
                  ) : null}
                </Stack>
              </form>
            </FormContainer>
          ) : null}
        </Stack>
      </Section>

      <Section title="Canvas">
        {selectedEntityId ? (
          <GraphExplorer graphId={graphId} entityId={selectedEntityId} initialAsOf={initialAsOf} />
        ) : (
          <Card className="border-dashed p-8 text-center text-sm text-slate-500">
            No entities yet. Create your first entity to start this graph.
          </Card>
        )}
      </Section>
    </PageLayout>
  )
}
