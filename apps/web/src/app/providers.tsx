'use client'

import { isServer, QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { createQueryClient } from '@/lib/api/query-client'
import type { ApiErrorTranslator } from '@/lib/errors/show-api-error-toast'

let browserQueryClient: QueryClient | undefined

function getQueryClient(translate: ApiErrorTranslator): QueryClient {
  if (isServer) {
    return createQueryClient(translate)
  }

  browserQueryClient ??= createQueryClient(translate)
  return browserQueryClient
}

interface ProvidersProps {
  readonly children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const translate = useTranslations()
  const queryClient = getQueryClient(translate)

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
