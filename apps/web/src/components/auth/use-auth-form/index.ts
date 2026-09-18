'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect } from 'react'

import {
  initialAuthActionState,
  type AuthActionState,
  type AuthFormAction,
} from '@/lib/auth/action-state'
import { describeApiError } from '@/lib/errors/api-error-presentation'
import { describeApiFieldIssues } from '@/lib/errors/api-field-issues'
import { showApiErrorAlert } from '@/lib/errors/show-api-error-alert'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'

import {
  fieldOfActionMessageKey,
  type AuthFieldName,
  type AuthFormMessageKey,
} from '@/lib/auth/form-validation'

export type AuthFieldErrors = Partial<Readonly<Record<AuthFieldName, AuthFormMessageKey>>>

export type { AuthFormAction } from '@/lib/auth/action-state'

type UseAuthFormOptions = {
  readonly action: AuthFormAction
  readonly requiresCaptcha: boolean
}

function fieldErrorsOf(state: AuthActionState): AuthFieldErrors {
  if (state.status === 'validation-error') {
    return { [fieldOfActionMessageKey(state.messageKey)]: `auth.${state.messageKey}` }
  }

  if (state.status !== 'api-error') return {}

  const issues = describeApiFieldIssues(state.error.issues)
  const description = describeApiError(state.error.code)

  return description.presentation === 'inline'
    ? { ...issues, [description.field]: description.messageKey }
    : issues
}

export type AuthFormBinding = ReturnType<typeof useAuthForm>

export function useAuthForm({ action, requiresCaptcha }: UseAuthFormOptions) {
  const translate = useTranslations()
  const [state, formAction, isSubmitting] = useActionState(action, initialAuthActionState)

  useEffect(() => {
    if (state.status !== 'api-error') return

    showApiErrorToast(state.error, translate)
    showApiErrorAlert(state.error, translate)
  }, [state, translate])

  return {
    captchaResetSignal: requiresCaptcha ? state : initialAuthActionState,
    fieldErrors: fieldErrorsOf(state),
    formAction,
    isSubmitting,
    state,
  }
}
