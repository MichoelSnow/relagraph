import { defineConfig } from "drizzle-kit"

import { getDatabaseUrl } from "./lib/env"

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: getDatabaseUrl()
  }
})
