import { toast } from 'sonner'

import type { ApiErrorDetails } from '@/lib/api/api-error'

import { describeApiError, type ApiErrorMessageKey } from './api-error-presentation'

export type ApiErrorTranslator = (key: ApiErrorMessageKey) => string

export function showApiErrorToast(error: ApiErrorDetails, t: ApiErrorTranslator): void {
  const description = describeApiError(error.code)

  if (description.presentation !== 'toast') return

  const message = t(description.messageKey)

  if (error.requestId === null) {
    toast.error(message)
    return
  }

  toast.error(message, { id: error.requestId })
}
