import type { ApiErrorDetails, ApiFieldIssue } from '@/lib/api/api-error'

type ApiClientErrorOptions = ApiErrorDetails & {
  readonly message: string
  readonly cause?: unknown
}

export class ApiClientError extends Error {
  readonly code: string
  readonly issues: readonly ApiFieldIssue[] | null
  readonly requestId: string | null

  constructor({ code, message, issues, requestId, cause }: ApiClientErrorOptions) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ApiClientError'
    this.code = code
    this.issues = issues
    this.requestId = requestId
  }
}
