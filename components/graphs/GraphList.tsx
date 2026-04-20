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
import Input from "@/components/ui/Input"
import SectionHeader from "@/components/ui/SectionHeader"

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
    <main className="console-atmosphere relative min-h-screen overflow-hidden bg-[var(--console-bg)] px-5 py-8 md:px-8 md:py-10">
      <div className="console-grid pointer-events-none absolute inset-0 opacity-[0.12]" />

      <section className="relative z-10 mx-auto w-full max-w-6xl">
        <Card as="header" className="fade-in mb-5 p-5 shadow-[var(--console-shadow-strong)]">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--console-border)] pb-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6fe8ff]">Relagraph Console</p>
            <Badge>/graphs</Badge>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--console-success)]">Workspace</p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--console-text-strong)]">Your Graphs</h1>
              <p className="mt-1 text-sm text-[var(--console-text-dim)]">Select an existing graph or create a new one.</p>
            </div>
            <Button
              type="button"
              onClick={() => logoutMutation.mutate()}
              variant="ghost"
              block
              className="md:w-auto"
            >
              Logout
            </Button>
          </div>
        </Card>

        <Card as="form" className="stagger-1 fade-in mb-5 p-5" onSubmit={onSubmit}>
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--console-text-muted)]">New graph name</span>
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
            className="mt-3 tracking-[0.14em]"
          >
            {createGraphMutation.isPending ? "Creating..." : "Create graph"}
          </Button>
          {createGraphMutation.error ? (
            <Card variant="danger" className="mt-3 px-3 py-2 text-sm">
              {(createGraphMutation.error as Error).message}
            </Card>
          ) : null}
        </Card>

        <Card className="stagger-2 fade-in p-5">
          <div className="mb-3 flex items-center justify-between">
            <SectionHeader>Existing graphs</SectionHeader>
            <Badge>{graphs.length} total</Badge>
          </div>
          {graphsQuery.isLoading ? (
            <Card variant="subpanel" className="p-3 text-sm text-[var(--console-text-dim)]">
              Loading your graphs...
            </Card>
          ) : null}
          {graphsQuery.error ? (
            <Card variant="danger" className="p-3 text-sm">
              {(graphsQuery.error as Error).message}
            </Card>
          ) : null}
          {graphs.length === 0 && !graphsQuery.isLoading ? (
            <Card variant="subpanel" className="border-dashed p-5 text-sm text-[var(--console-text-dim)]">
              No graphs yet. Create your first graph above to get started.
            </Card>
          ) : null}
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {graphs.map((graph) => (
              <li key={graph.id}>
                <Link
                  href={`/graphs/${graph.id}`}
                  className="block rounded-xl border border-[var(--console-border)] bg-[var(--console-panel-muted)] px-4 py-3 text-[var(--console-text)] transition hover:-translate-y-0.5 hover:border-[var(--console-accent)] hover:bg-[#0f1f35]"
                >
                  <p className="truncate font-semibold text-[var(--console-text-strong)]">{graph.name}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--console-text-muted)]">
                    Open graph workspace
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </main>
  )
}
