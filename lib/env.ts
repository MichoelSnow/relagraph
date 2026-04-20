export type AppEnv = "local" | "prod"

const DEFAULT_PORT = 3000
const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:3000"

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : undefined
}

function readRequiredEnv(name: string): string {
  const value = readOptionalEnv(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function getAppEnv(): AppEnv {
  const explicit = readOptionalEnv("APP_ENV")
  if (explicit === "local" || explicit === "prod") {
    return explicit
  }

  return process.env.NODE_ENV === "production" ? "prod" : "local"
}

export function isProdEnv(): boolean {
  return getAppEnv() === "prod"
}

export function getPort(): number {
  const raw = readOptionalEnv("PORT")
  if (!raw) {
    return DEFAULT_PORT
  }

  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`PORT must be a positive integer. Received: ${raw}`)
  }

  return parsed
}

export function getApiBaseUrl(): string {
  return readOptionalEnv("NEXT_PUBLIC_API_BASE_URL") ?? DEFAULT_LOCAL_API_BASE_URL
}

export function getDatabaseUrl(): string {
  return readRequiredEnv("DATABASE_URL")
}
