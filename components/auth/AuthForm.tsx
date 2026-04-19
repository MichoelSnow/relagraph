"use client"

import { useMutation } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

import { login, register } from "@/lib/api/auth"

type Mode = "login" | "register"

export default function AuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const authMutation = useMutation({
    mutationFn: async () => {
      if (mode === "login") {
        return login({ email, password })
      }

      return register({ email, password })
    },
    onSuccess: () => {
      router.push("/graphs")
      router.refresh()
    }
  })

  const submitLabel = mode === "login" ? "Sign in" : "Create account"

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    authMutation.mutate()
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-4">
      <section className="w-full rounded-md border border-slate-300 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Relagraph</h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === "login" ? "Sign in to continue." : "Create an account to get started."}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={`rounded px-3 py-1 text-sm ${mode === "login" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 text-sm ${mode === "register" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              required
            />
          </label>

          <label className="block text-sm text-slate-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              minLength={8}
              required
            />
          </label>

          {authMutation.error ? (
            <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
              {(authMutation.error as Error).message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={authMutation.isPending}
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {authMutation.isPending ? "Please wait..." : submitLabel}
          </button>
        </form>
      </section>
    </main>
  )
}
