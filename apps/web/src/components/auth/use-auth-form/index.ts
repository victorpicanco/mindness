'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect } from 'react'

import { initialAuthActionState, type AuthActionState } from '@/lib/auth/action-state'
import { describeApiError } from '@/lib/errors/api-error-presentation'
import { describeApiFieldIssues } from '@/lib/errors/api-field-issues'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'

import {
  fieldOfActionMessageKey,
  type AuthFieldName,
  type AuthFormMessageKey,
} from '@/lib/auth/form-validation'

export type AuthFieldErrors = Partial<Readonly<Record<AuthFieldName, AuthFormMessageKey>>>

export type AuthFormAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>

type UseAuthFormOptions = {
  readonly action: AuthFormAction
  readonly requiresCaptcha: boolean
}

function fieldErrorsOf(state: AuthActionState): AuthFieldErrors {
  if (state.status === 'validation-error') {
    return { [fieldOfActionMessageKey(state.messageKey)]: `auth.${state.messageKey}` }
  }

  return state.status === 'api-error' ? describeApiFieldIssues(state.error.issues) : {}
}

function inlineMessageKeyOf(state: AuthActionState): AuthFormMessageKey | undefined {
  if (state.status !== 'api-error') return undefined

  const description = describeApiError(state.error.code)

  return description.presentation === 'inline' ? description.messageKey : undefined
}

export type AuthFormBinding = ReturnType<typeof useAuthForm>

export function useAuthForm({ action, requiresCaptcha }: UseAuthFormOptions) {
  const translate = useTranslations()
  const [state, formAction, isSubmitting] = useActionState(action, initialAuthActionState)

  useEffect(() => {
    if (state.status === 'api-error') showApiErrorToast(state.error, translate)
  }, [state, translate])

  return {
    captchaResetSignal: requiresCaptcha ? state : initialAuthActionState,
    fieldErrors: fieldErrorsOf(state),
    formAction,
    inlineMessageKey: inlineMessageKeyOf(state),
    isSubmitting,
    state,
  }
}
