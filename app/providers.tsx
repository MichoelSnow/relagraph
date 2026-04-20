"use client"

import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query"

type ProvidersProps = {
  children: React.ReactNode
}

function createQueryClient(): QueryClient {
  return new QueryClient()
}

let browserQueryClient: QueryClient | undefined

function getQueryClient(): QueryClient {
  if (isServer) {
    return createQueryClient()
  }

  if (!browserQueryClient) {
    browserQueryClient = createQueryClient()
  }

  return browserQueryClient
}

export default function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient()

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
