type ApiErrorEnvelope = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
    throw new Error(errorBody?.error?.message ?? `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function login(input: { email: string; password: string }): Promise<{ id: string; email: string }> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  })

  return parseOrThrow(response)
}

export async function register(input: {
  email: string
  password: string
}): Promise<{ id: string; email: string }> {
  const response = await fetch("/api/v1/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  })

  return parseOrThrow(response)
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/v1/auth/logout", { method: "POST" })
  await parseOrThrow<{ ok: true }>(response)
}
