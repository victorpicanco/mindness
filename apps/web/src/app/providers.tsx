'use client'

import { isServer, MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { apiErrorDetails } from '@/lib/api/api-error'
import { showApiErrorToast, type ApiErrorTranslator } from '@/lib/errors/show-api-error-toast'

let browserQueryClient: QueryClient | undefined

function shouldShowMutationError(meta: unknown): boolean {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    'errorPresentation' in meta &&
    meta.errorPresentation === 'toast'
  )
}

function makeQueryClient(translate: ApiErrorTranslator): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!shouldShowMutationError(mutation.meta)) return

        showApiErrorToast(apiErrorDetails(error), translate)
      },
    }),
  })
}

function getQueryClient(translate: ApiErrorTranslator): QueryClient {
  if (isServer) {
    return makeQueryClient(translate)
  }

  browserQueryClient ??= makeQueryClient(translate)
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
