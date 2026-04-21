"use client"

import { useMutation } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

import { register } from "@/lib/api/auth"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import FieldLabel from "@/components/ui/FieldLabel"
import FormContainer from "@/components/ui/FormContainer"
import Input from "@/components/ui/Input"
import PageHeader from "@/components/ui/PageHeader"
import PageLayout from "@/components/ui/PageLayout"
import Section from "@/components/ui/Section"
import Stack from "@/components/ui/Stack"
import VisibilityIcon from "@/components/ui/VisibilityIcon"

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
                  <FieldLabel>Username</FieldLabel>
                  <Input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="your-username"
                    required
                  />
                </label>

                <label className="block">
                  <FieldLabel>Password</FieldLabel>
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
                      <VisibilityIcon hidden={showPassword} />
                    </button>
                  </div>
                </label>

                {mode === "register" ? (
                  <label className="block">
                    <FieldLabel>Confirm password</FieldLabel>
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
                        <VisibilityIcon hidden={showConfirmPassword} />
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
