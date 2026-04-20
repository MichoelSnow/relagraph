"use client"

import { useMutation } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

import { login, register } from "@/lib/api/auth"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import Input from "@/components/ui/Input"

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
    <main className="console-atmosphere relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="console-grid pointer-events-none absolute inset-0 opacity-[0.14]" />

      <Card className="fade-in relative z-10 w-full max-w-[460px] shadow-[var(--console-shadow-strong)]">
        <header className="flex items-center justify-between rounded-t-2xl border-b border-[var(--console-border)] bg-[var(--console-subpanel)] px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6fe8ff]">Relagraph Console</p>
          <Badge>v0.1</Badge>
        </header>

        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--console-success)]">Authentication</p>
          <h1 className="mt-2 text-xl font-semibold text-[var(--console-text-strong)]">
            {mode === "login" ? "Access Workspace" : "Create Operator Account"}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--console-text-dim)]">
            {mode === "login" ? "Sign in to open your graph workspace." : "Create a new account for this instance."}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-[var(--console-border)] bg-[var(--console-subpanel)] p-1">
            <Button
              type="button"
              size="md"
              variant={mode === "login" ? "primary" : "ghost"}
              className={`rounded-md border ${
                mode === "login"
                  ? "border-[var(--console-accent)] bg-[#08222b] text-[#6fe8ff]"
                  : "border-transparent bg-transparent text-[var(--console-text-muted)] hover:bg-[#131d31]"
              }`}
              onClick={() => setMode("login")}
            >
              Login
            </Button>
            <Button
              type="button"
              size="md"
              variant={mode === "register" ? "primary" : "ghost"}
              className={`rounded-md border ${
                mode === "register"
                  ? "border-[var(--console-accent)] bg-[#08222b] text-[#6fe8ff]"
                  : "border-transparent bg-transparent text-[var(--console-text-muted)] hover:bg-[#131d31]"
              }`}
              onClick={() => setMode("register")}
            >
              Register
            </Button>
          </div>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--console-text-muted)]">Email</span>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--console-text-muted)]">Password</span>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>

            {authMutation.error ? (
              <Card variant="danger" className="px-3 py-2 text-sm">
                {(authMutation.error as Error).message}
              </Card>
            ) : null}

            <Button
              type="submit"
              disabled={authMutation.isPending}
              block
              variant="primary"
              className="tracking-[0.14em]"
            >
              {authMutation.isPending ? "Processing..." : submitLabel}
            </Button>
          </form>
        </div>
      </Card>
    </main>
  )
}
