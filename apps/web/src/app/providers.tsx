'use client'

import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

function makeQueryClient() {
  return new QueryClient()
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (isServer) {
    return makeQueryClient()
  }

  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

interface ProvidersProps {
  readonly children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient()

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
