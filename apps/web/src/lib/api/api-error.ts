export type ApiFieldIssue = {
  readonly field: string
  readonly message: string
}

export type ApiErrorDetails = {
  readonly code: string
  readonly issues: readonly ApiFieldIssue[] | null
  readonly requestId: string | null
}

function isApiFieldIssue(value: unknown): value is ApiFieldIssue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'field' in value &&
    'message' in value &&
    typeof value.field === 'string' &&
    typeof value.message === 'string'
  )
}

function isApiErrorDetails(value: unknown): value is ApiErrorDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'issues' in value &&
    'requestId' in value &&
    typeof value.code === 'string' &&
    (value.issues === null ||
      (Array.isArray(value.issues) && value.issues.every(isApiFieldIssue))) &&
    (value.requestId === null || typeof value.requestId === 'string')
  )
}

function unknownApiErrorDetails(): ApiErrorDetails {
  return {
    code: 'web.UNEXPECTED_ERROR',
    issues: null,
    requestId: null,
  }
}

export function apiErrorDetails(error: unknown): ApiErrorDetails {
  if (!isApiErrorDetails(error)) return unknownApiErrorDetails()

  return {
    code: error.code,
    issues:
      error.issues === null
        ? null
        : error.issues.map((issue) => ({ field: issue.field, message: issue.message })),
    requestId: error.requestId,
  }
}
