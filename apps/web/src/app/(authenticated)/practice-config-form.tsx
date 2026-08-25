'use client'

import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'

import { signOutAction } from '@/app/auth/sign-out/actions'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { apiErrorDetails, type ApiErrorDetails, type ApiFieldIssue } from '@/lib/api/api-error'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

const DIFFICULTIES = ['easy', 'balanced', 'hard'] as const
const SEARCH_WINDOWS = [3, 4, 5] as const

const QUOTA_EXHAUSTED_CODE = 'quota.QUOTA_EXHAUSTED'
const THEME_UNAVAILABLE_CODE = 'sessions.THEME_UNAVAILABLE'
const PRACTICE_NOT_ALLOWED_CODE = 'sessions.PRACTICE_NOT_ALLOWED'

const startedSessionSchema = z.object({
  expiresAt: z.iso.datetime(),
  researchEndsAt: z.iso.datetime(),
  sessionId: z.uuid(),
  themeTitle: z.string(),
})

const successEnvelopeSchema = z.object({ data: z.unknown() })

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    issues: z.array(z.object({ field: z.string(), message: z.string() })).nullable(),
    message: z.string(),
    requestId: z.string(),
  }),
})

export type SessionDifficulty = (typeof DIFFICULTIES)[number]
export type SearchWindowMinutes = (typeof SEARCH_WINDOWS)[number]

export interface PracticeCategory {
  readonly categoryId: string
  readonly name: string
  readonly slug: string
}

export interface PracticeQuota {
  readonly allowance: number
  readonly renewsAt: string
}

export interface StartSessionInput {
  readonly categorySlug: string
  readonly difficulty: SessionDifficulty
  readonly searchWindowMinutes: SearchWindowMinutes
}

export interface StartedSession {
  readonly expiresAt: string
  readonly researchEndsAt: string
  readonly sessionId: string
  readonly themeTitle: string
}

export type StartSessionRequest = (input: StartSessionInput) => Promise<StartedSession>

type PracticeSessionRequestErrorOptions = ApiErrorDetails & {
  readonly message: string
  readonly cause?: unknown
}

export class PracticeSessionRequestError extends Error {
  readonly code: string
  readonly issues: readonly ApiFieldIssue[] | null
  readonly requestId: string | null

  constructor({ cause, code, issues, message, requestId }: PracticeSessionRequestErrorOptions) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'PracticeSessionRequestError'
    this.code = code
    this.issues = issues
    this.requestId = requestId
  }
}

async function requestSessionStart(input: StartSessionInput): Promise<StartedSession> {
  const response = await fetch('/api/bff/sessions', {
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  const body: unknown = await response.json()

  if (!response.ok) {
    const envelope = errorEnvelopeSchema.safeParse(body)

    throw new PracticeSessionRequestError(
      envelope.success
        ? envelope.data.error
        : {
            code: 'web.API_RESPONSE_INVALID',
            issues: null,
            message: 'The API returned an invalid response.',
            requestId: null,
          },
    )
  }

  return startedSessionSchema.parse(successEnvelopeSchema.parse(body).data)
}

function toDifficulty(value: string): SessionDifficulty | null {
  return DIFFICULTIES.find((difficulty) => difficulty === value) ?? null
}

function toSearchWindowMinutes(value: string): SearchWindowMinutes | null {
  return SEARCH_WINDOWS.find((minutes) => String(minutes) === value) ?? null
}

function renewalDate(renewsAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(renewsAt))
}

interface PracticeConfigFormProps {
  readonly categories: readonly PracticeCategory[]
  readonly onSessionStarted?: (sessionId: string) => void
  readonly quota: PracticeQuota | null
  readonly startSession?: StartSessionRequest
}

export function PracticeConfigForm({
  categories,
  onSessionStarted,
  quota,
  startSession = requestSessionStart,
}: PracticeConfigFormProps) {
  const t = useTranslations('home.practice')
  const translate = useTranslations()
  const startResearching = usePracticeSessionStore((state) => state.startResearching)
  const [difficulty, setDifficulty] = useState<SessionDifficulty | null>(null)
  const [categorySlug, setCategorySlug] = useState('')
  const [searchWindowMinutes, setSearchWindowMinutes] = useState<SearchWindowMinutes | null>(null)

  const mutation = useMutation({
    mutationFn: startSession,
    onSuccess: (session) => {
      startResearching(session)
      onSessionStarted?.(session.sessionId)
    },
  })

  const configuration: StartSessionInput | null =
    difficulty === null || categorySlug === '' || searchWindowMinutes === null
      ? null
      : { categorySlug, difficulty, searchWindowMinutes }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (configuration === null) return

    mutation.mutate(configuration)
  }

  const failureCode = mutation.isError ? apiErrorDetails(mutation.error).code : null
  const isConsentPending = failureCode === PRACTICE_NOT_ALLOWED_CODE

  function failureMessage(code: string): string {
    if (code === QUOTA_EXHAUSTED_CODE && quota !== null) {
      return t('errors.quotaExhausted', {
        allowance: quota.allowance,
        date: renewalDate(quota.renewsAt),
      })
    }
    if (code === THEME_UNAVAILABLE_CODE) return t('errors.themeUnavailable')
    if (code === PRACTICE_NOT_ALLOWED_CODE) return t('errors.practiceNotAllowed')

    return translate('common.errors.unknown')
  }

  return (
    <div className="mt-8 flex w-full max-w-4xl flex-col gap-4">
      <form
        className="flex w-full flex-col gap-4 sm:flex-row sm:items-end"
        noValidate
        onSubmit={handleSubmit}
      >
        <Field label={t('difficultyLabel')}>
          <Select
            onChange={(event) => {
              setDifficulty(toDifficulty(event.target.value))
            }}
            value={difficulty ?? ''}
          >
            <option value="">{t('difficultyPlaceholder')}</option>
            {DIFFICULTIES.map((option) => (
              <option key={option} value={option}>
                {t(`difficulties.${option}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('categoryLabel')}>
          <Select
            onChange={(event) => {
              setCategorySlug(event.target.value)
            }}
            value={categorySlug}
          >
            <option value="">{t('categoryPlaceholder')}</option>
            {categories.map((category) => (
              <option key={category.categoryId} value={category.slug}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('searchWindowLabel')}>
          <Select
            onChange={(event) => {
              setSearchWindowMinutes(toSearchWindowMinutes(event.target.value))
            }}
            value={searchWindowMinutes === null ? '' : String(searchWindowMinutes)}
          >
            <option value="">{t('searchWindowPlaceholder')}</option>
            {SEARCH_WINDOWS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {t('searchWindowOption', { minutes })}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          className="w-full shrink-0 sm:w-auto"
          disabled={configuration === null}
          isLoading={mutation.isPending}
          size="lg"
          type="submit"
        >
          {t('startSession')}
        </Button>
      </form>
      {failureCode === null ? null : (
        <div className="flex flex-col items-start gap-3 text-sm text-error" role="alert">
          <p>{failureMessage(failureCode)}</p>
          {isConsentPending ? (
            <form action={signOutAction}>
              <Button size="sm" type="submit" variant="secondary">
                {t('signOutToRetry')}
              </Button>
            </form>
          ) : null}
        </div>
      )}
    </div>
  )
}
