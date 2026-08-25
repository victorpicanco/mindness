'use client'

import { useTranslations } from 'next-intl'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'

import { TURNSTILE_TOKEN_FIELD_NAME } from '@/components/ui/turnstile'
import { describeApiError } from '@/lib/errors/api-error-presentation'
import { describeApiFieldIssues } from '@/lib/errors/api-field-issues'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'

import { initialAuthActionState, type AuthActionState } from '@/lib/auth/action-state'
import {
  fieldOfActionMessageKey,
  type AuthFieldName,
  type AuthFormMessageKey,
} from '@/lib/auth/form-validation'

// A submission that arrives before the widget has a token waits for one instead
// of failing: the widget always resets after a submission, so the token is
// briefly empty exactly when a visitor is most likely to retry.
const CAPTCHA_WAIT_TIMEOUT_MS = 20_000

export type AuthFieldErrors = Partial<Readonly<Record<AuthFieldName, AuthFormMessageKey>>>

export type AuthFormAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>

type UseAuthFormOptions = {
  readonly action: AuthFormAction
  readonly requiresCaptcha: boolean
  readonly validate?: (formData: FormData) => AuthFieldErrors
}

export type AuthFormBinding = {
  readonly captchaResetSignal: number
  readonly fieldErrors: AuthFieldErrors
  readonly inlineMessageKey: AuthFormMessageKey | undefined
  readonly isSubmitting: boolean
  readonly onCaptchaError: () => void
  readonly onCaptchaTokenChange: (token: string) => void
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void
  readonly state: AuthActionState
}

function hasFieldError(errors: AuthFieldErrors): boolean {
  return Object.values(errors).some((messageKey) => messageKey !== undefined)
}

function inlineMessageKeyOf(state: AuthActionState): AuthFormMessageKey | undefined {
  if (state.status !== 'api-error') return undefined

  const description = describeApiError(state.error.code)

  return description.presentation === 'inline' ? description.messageKey : undefined
}

export function useAuthForm({
  action,
  requiresCaptcha,
  validate,
}: UseAuthFormOptions): AuthFormBinding {
  const translate = useTranslations()
  const [state, setState] = useState<AuthActionState>(initialAuthActionState)
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0)
  const [captchaToken, setCaptchaToken] = useState('')
  const [isAwaitingCaptcha, setIsAwaitingCaptcha] = useState(false)
  const pendingFormDataRef = useRef<FormData | null>(null)
  const captchaTokenRef = useRef('')
  const stateRef = useRef(state)
  const actionRef = useRef(action)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    actionRef.current = action
  }, [action])

  const runAction = useCallback(
    async (formData: FormData, token: string): Promise<void> => {
      if (requiresCaptcha) formData.set(TURNSTILE_TOKEN_FIELD_NAME, token)

      const result = await actionRef.current(stateRef.current, formData)

      setState(result)
      setIsSubmitting(false)
      if (requiresCaptcha) setCaptchaResetSignal((signal) => signal + 1)

      if (result.status === 'validation-error') {
        setFieldErrors({
          [fieldOfActionMessageKey(result.messageKey)]: `auth.${result.messageKey}`,
        })
        return
      }

      if (result.status !== 'api-error') {
        setFieldErrors({})
        return
      }

      setFieldErrors(describeApiFieldIssues(result.error.issues))
      showApiErrorToast(result.error, translate)
    },
    [requiresCaptcha, translate],
  )

  useEffect(() => {
    if (!isAwaitingCaptcha) return undefined

    const formData = pendingFormDataRef.current

    if (captchaToken !== '' && formData !== null) {
      pendingFormDataRef.current = null
      setIsAwaitingCaptcha(false)
      void runAction(formData, captchaToken)

      return undefined
    }

    const timeout = setTimeout(() => {
      pendingFormDataRef.current = null
      setIsAwaitingCaptcha(false)
      setIsSubmitting(false)
      setFieldErrors((current) => ({ ...current, captchaToken: 'auth.errors.captchaUnavailable' }))
    }, CAPTCHA_WAIT_TIMEOUT_MS)

    return () => {
      clearTimeout(timeout)
    }
  }, [captchaToken, isAwaitingCaptcha, runAction])

  const onCaptchaTokenChange = useCallback((token: string): void => {
    captchaTokenRef.current = token
    setCaptchaToken(token)

    if (token === '') return

    setFieldErrors((current) => {
      if (current.captchaToken === undefined) return current

      const remaining: { -readonly [Key in AuthFieldName]?: AuthFormMessageKey } = { ...current }
      delete remaining.captchaToken

      return remaining
    })
  }, [])

  const onCaptchaError = useCallback((): void => {
    pendingFormDataRef.current = null
    captchaTokenRef.current = ''
    setCaptchaToken('')
    setIsAwaitingCaptcha(false)
    setIsSubmitting(false)
    setFieldErrors((current) => ({ ...current, captchaToken: 'auth.errors.captchaUnavailable' }))
  }, [])

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault()
      const formData = new FormData(event.currentTarget)
      const validationErrors = validate?.(formData) ?? {}

      setFieldErrors(validationErrors)

      if (hasFieldError(validationErrors)) return

      setIsSubmitting(true)

      if (requiresCaptcha && captchaTokenRef.current === '') {
        pendingFormDataRef.current = formData
        setIsAwaitingCaptcha(true)
        return
      }

      void runAction(formData, captchaTokenRef.current)
    },
    [requiresCaptcha, runAction, validate],
  )

  return {
    captchaResetSignal,
    fieldErrors,
    inlineMessageKey: inlineMessageKeyOf(state),
    isSubmitting: isSubmitting || isAwaitingCaptcha,
    onCaptchaError,
    onCaptchaTokenChange,
    onSubmit,
    state,
  }
}
