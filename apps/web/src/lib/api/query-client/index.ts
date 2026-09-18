import { MutationCache, QueryClient } from '@tanstack/react-query'

import { apiErrorDetails } from '@/lib/api/api-error'
import { showApiErrorAlert, type AlertTranslator } from '@/lib/errors/show-api-error-alert'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'

function announcesOwnFailure(meta: unknown): boolean {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    'announcesOwnFailure' in meta &&
    meta.announcesOwnFailure === true
  )
}

export function createQueryClient(translate: AlertTranslator): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (announcesOwnFailure(mutation.meta)) return

        const details = apiErrorDetails(error)

        showApiErrorToast(details, translate)
        showApiErrorAlert(details, translate)
      },
    }),
  })
}
