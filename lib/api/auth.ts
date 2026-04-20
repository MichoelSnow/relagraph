type ApiErrorEnvelope = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

type RegisterInput = {
  username: string
  password: string
}

type RegisterResponse = {
  id: string
  username: string
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorEnvelope | null
    throw new Error(errorBody?.error?.message ?? `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function register(input: RegisterInput): Promise<RegisterResponse> {
  const response = await fetch("/api/v1/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  })

  return parseOrThrow<RegisterResponse>(response)
}
