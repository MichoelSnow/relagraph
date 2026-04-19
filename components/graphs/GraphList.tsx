"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

import { logout } from "@/lib/api/auth"
import { createGraph, fetchGraphs } from "@/lib/api/graphs"

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
    mutationFn: logout,
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
    <main className="mx-auto min-h-screen w-full max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between rounded-md border border-slate-300 bg-white p-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Your Graphs</h1>
          <p className="text-sm text-slate-600">Select an existing graph or create a new one.</p>
        </div>
        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          Logout
        </button>
      </header>

      <form className="mb-4 rounded-md border border-slate-300 bg-white p-4" onSubmit={onSubmit}>
        <label className="block text-sm text-slate-700">
          New graph name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Family graph"
            required
          />
        </label>
        <button
          type="submit"
          disabled={createGraphMutation.isPending}
          className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {createGraphMutation.isPending ? "Creating..." : "Create graph"}
        </button>
        {createGraphMutation.error ? (
          <p className="mt-3 text-sm text-rose-700">{(createGraphMutation.error as Error).message}</p>
        ) : null}
      </form>

      <section className="rounded-md border border-slate-300 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Existing graphs</h2>
        {graphsQuery.isLoading ? <p className="mt-2 text-sm text-slate-600">Loading...</p> : null}
        {graphsQuery.error ? (
          <p className="mt-2 text-sm text-rose-700">{(graphsQuery.error as Error).message}</p>
        ) : null}
        {graphs.length === 0 && !graphsQuery.isLoading ? (
          <p className="mt-2 text-sm text-slate-600">No graphs yet.</p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {graphs.map((graph) => (
            <li key={graph.id}>
              <Link
                href={`/graphs/${graph.id}`}
                className="block rounded border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
              >
                {graph.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
