"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"

import { createGraph, fetchGraphs } from "@/lib/api/graphs"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import FormContainer from "@/components/ui/FormContainer"
import Input from "@/components/ui/Input"
import PageHeader from "@/components/ui/PageHeader"
import PageLayout from "@/components/ui/PageLayout"
import Section from "@/components/ui/Section"
import Stack from "@/components/ui/Stack"

export default function GraphList() {
  const [name, setName] = useState("")
  const queryClient = useQueryClient()
  const router = useRouter()

  const graphsQuery = useQuery({
    queryKey: ["graphs"],
    queryFn: fetchGraphs
  })

  const createGraphMutation = useMutation({
    mutationFn: async () => createGraph(name.trim()),
    onSuccess: (graph) => {
      setName("")
      queryClient.invalidateQueries({ queryKey: ["graphs"] })
      router.push(`/graphs/${graph.id}`)
    }
  })

  const logoutMutation = useMutation({
    mutationFn: () => signOut({ redirect: false }),
    onSuccess: () => {
      router.push("/login")
      router.refresh()
    }
  })

  const graphs = graphsQuery.data ?? []

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      return
    }

    createGraphMutation.mutate()
  }

  return (
    <PageLayout>
      <PageHeader
        title="Your Graphs"
        description="Select an existing graph or create a new one."
        action={(
          <Button type="button" onClick={() => logoutMutation.mutate()} variant="ghost">
            Logout
          </Button>
        )}
      />

      <Section title="Create Graph">
        <FormContainer>
          <form onSubmit={onSubmit}>
            <Stack className="gap-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">New graph name</span>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Family graph"
                  required
                />
              </label>
              <Button
                type="submit"
                disabled={createGraphMutation.isPending}
                variant="primary"
              >
                {createGraphMutation.isPending ? "Creating..." : "Create graph"}
              </Button>
              {createGraphMutation.error ? (
                <Card variant="danger" className="px-3 py-2 text-sm">
                  {(createGraphMutation.error as Error).message}
                </Card>
              ) : null}
            </Stack>
          </form>
        </FormContainer>
      </Section>

      <Section title="Existing Graphs">
        <Stack className="gap-3">
          <div className="flex items-center justify-between">
            <Badge>{graphs.length} total</Badge>
          </div>
          {graphsQuery.isLoading ? (
            <Card variant="subpanel" className="p-3 text-sm text-slate-500">
              Loading your graphs...
            </Card>
          ) : null}
          {graphsQuery.error ? (
            <Card variant="danger" className="p-3 text-sm">
              {(graphsQuery.error as Error).message}
            </Card>
          ) : null}
          {graphs.length === 0 && !graphsQuery.isLoading ? (
            <Card variant="subpanel" className="border-dashed p-5 text-sm text-slate-500">
              No graphs yet. Create your first graph above to get started.
            </Card>
          ) : null}
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {graphs.map((graph) => (
              <li key={graph.id}>
                <Link
                  href={`/graphs/${graph.id}`}
                  className="block rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 transition-colors hover:bg-slate-100"
                >
                  <p className="truncate font-semibold">{graph.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open graph workspace
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Stack>
      </Section>
    </PageLayout>
  )
}
