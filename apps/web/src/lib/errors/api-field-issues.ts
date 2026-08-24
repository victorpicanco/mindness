import type { ApiFieldIssue } from '@/lib/api/api-error'

import type { ApiErrorMessageKey } from './api-error-presentation'

export type ApiFieldName = 'captchaToken' | 'email' | 'password'

export type ApiFieldMessages = Partial<Readonly<Record<ApiFieldName, ApiErrorMessageKey>>>

const MESSAGE_KEY_BY_FIELD: Readonly<Record<ApiFieldName, ApiErrorMessageKey>> = {
  captchaToken: 'auth.errors.captchaRequired',
  email: 'auth.errors.invalidEmail',
  password: 'auth.errors.invalidPassword',
}

function isApiFieldName(field: string): field is ApiFieldName {
  return Object.hasOwn(MESSAGE_KEY_BY_FIELD, field)
}

export function describeApiFieldIssues(issues: readonly ApiFieldIssue[] | null): ApiFieldMessages {
  if (issues === null) return {}

  const messages: {
    -readonly [Key in ApiFieldName]?: ApiErrorMessageKey
  } = {}

  for (const issue of issues) {
    if (!isApiFieldName(issue.field)) continue

    messages[issue.field] = MESSAGE_KEY_BY_FIELD[issue.field]
  }

  return messages
}
