import { MutationCache, QueryClient } from '@tanstack/react-query'

import { apiErrorDetails } from '@/lib/api/api-error'
import { showApiErrorToast, type ApiErrorTranslator } from '@/lib/errors/show-api-error-toast'
function rendersErrorsInline(meta: unknown): boolean {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    'errorPresentation' in meta &&
    meta.errorPresentation === 'inline'
  )
}

export function createQueryClient(translate: ApiErrorTranslator): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (rendersErrorsInline(mutation.meta)) return

        showApiErrorToast(apiErrorDetails(error), translate)
      },
    }),
  })
}
