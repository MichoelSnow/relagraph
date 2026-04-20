"use client"

import { useMutation } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

import { register } from "@/lib/api/auth"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import FormContainer from "@/components/ui/FormContainer"
import Input from "@/components/ui/Input"
import PageHeader from "@/components/ui/PageHeader"
import PageLayout from "@/components/ui/PageLayout"
import Section from "@/components/ui/Section"
import Stack from "@/components/ui/Stack"

type Mode = "login" | "register"

export default function AuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const authMutation = useMutation({
    mutationFn: async () => {
      const normalizedUsername = username.trim().toLowerCase()
      const normalizedPassword = password

      if (mode === "register") {
        if (normalizedPassword !== confirmPassword) {
          throw new Error("Passwords do not match")
        }
        await register({ username: normalizedUsername, password: normalizedPassword })
      }

      const result = await signIn("credentials", {
        username: normalizedUsername,
        password: normalizedPassword,
        redirect: false
      })

      if (!result || result.error) {
        throw new Error("Invalid username or password")
      }
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
    <PageLayout className="min-h-screen flex items-center justify-center">
      <FormContainer>
        <PageHeader
          title={mode === "login" ? "Access Workspace" : "Create Operator Account"}
          description={mode === "login" ? "Sign in to open your graph workspace." : "Create a new account for this instance."}
          action={<Badge>Beta</Badge>}
        />

        <Section title="Authentication">
          <Stack>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--console-border)] bg-[var(--console-subpanel)] p-1">
              <Button
                type="button"
                size="md"
                variant={mode === "login" ? "primary" : "ghost"}
                className="rounded-md"
                onClick={() => setMode("login")}
              >
                Login
              </Button>
              <Button
                type="button"
                size="md"
                variant={mode === "register" ? "primary" : "ghost"}
                className="rounded-md"
                onClick={() => setMode("register")}
              >
                Register
              </Button>
            </div>

            <form onSubmit={onSubmit}>
              <Stack>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Username</span>
                  <Input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="your-username"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Password</span>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={8}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((previous) => !previous)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--console-text-muted)] hover:text-[var(--console-text)]"
                    >
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
                          <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 10 8 10 8a15.7 15.7 0 0 1-4.2 5.1" />
                          <path d="M6.6 6.6A15.8 15.8 0 0 0 2 12s3 8 10 8a10.5 10.5 0 0 0 5.4-1.5" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>

                {mode === "register" ? (
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-[var(--console-text-muted)]">Confirm password</span>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        minLength={8}
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        onClick={() => setShowConfirmPassword((previous) => !previous)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--console-text-muted)] hover:text-[var(--console-text)]"
                      >
                        {showConfirmPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M3 3l18 18" />
                            <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
                            <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 10 8 10 8a15.7 15.7 0 0 1-4.2 5.1" />
                            <path d="M6.6 6.6A15.8 15.8 0 0 0 2 12s3 8 10 8a10.5 10.5 0 0 0 5.4-1.5" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>
                ) : null}

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
                >
                  {authMutation.isPending ? "Processing..." : submitLabel}
                </Button>
              </Stack>
            </form>
          </Stack>
        </Section>
      </FormContainer>
    </PageLayout>
  )
}
