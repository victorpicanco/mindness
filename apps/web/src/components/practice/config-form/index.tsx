'use client'

import { useMutation } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { apiErrorDetails } from '@/lib/api/api-error'
import { sessionPath } from '@/lib/navigation/session-routes'
import { bffFetch } from '@/lib/api/bff-client'
import { startedSessionSchema } from '@/lib/api/contracts/sessions'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

const DIFFICULTIES = ['easy', 'balanced', 'hard'] as const
const SEARCH_WINDOWS = [3, 4, 5] as const

const QUOTA_EXHAUSTED_CODE = 'quota.QUOTA_EXHAUSTED'
const THEME_UNAVAILABLE_CODE = 'sessions.THEME_UNAVAILABLE'
const PRACTICE_NOT_ALLOWED_CODE = 'sessions.PRACTICE_NOT_ALLOWED'

type SessionDifficulty = (typeof DIFFICULTIES)[number]
type SearchWindowMinutes = (typeof SEARCH_WINDOWS)[number]

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

interface StartedSession {
  readonly createdAt: string
  readonly expiresAt: string
  readonly remaining: number | null
  readonly researchEndsAt: string
  readonly serverNow: string
  readonly sessionId: string
  readonly themeId: string
  readonly themeTitle: string
}

export type StartSessionRequest = (input: StartSessionInput) => Promise<StartedSession>

export type SignOutAction = () => void | Promise<void>

async function requestSessionStart(input: StartSessionInput): Promise<StartedSession> {
  return bffFetch('/sessions', {
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    schema: startedSessionSchema,
  })
}

function toDifficulty(value: string): SessionDifficulty | null {
  return DIFFICULTIES.find((difficulty) => difficulty === value) ?? null
}

function toSearchWindowMinutes(value: string): SearchWindowMinutes | null {
  return SEARCH_WINDOWS.find((minutes) => String(minutes) === value) ?? null
}

interface PracticeConfigFormProps {
  readonly categories: readonly PracticeCategory[]
  readonly onSessionStarted?: (sessionId: string) => void
  readonly quota: PracticeQuota | null
  readonly signOut: SignOutAction
  readonly startSession?: StartSessionRequest
}

export function PracticeConfigFormWithNavigation(
  props: Pick<PracticeConfigFormProps, 'categories' | 'quota' | 'signOut'>,
) {
  const router = useRouter()

  return (
    <PracticeConfigForm
      {...props}
      onSessionStarted={(sessionId) => router.push(sessionPath(sessionId))}
    />
  )
}

export function PracticeConfigForm({
  categories,
  onSessionStarted,
  quota,
  signOut,
  startSession = requestSessionStart,
}: PracticeConfigFormProps) {
  const t = useTranslations('home.practice')
  const translate = useTranslations()
  const format = useFormatter()
  const startResearching = usePracticeSessionStore((state) => state.startResearching)
  const [difficulty, setDifficulty] = useState<SessionDifficulty | null>(null)
  const [categorySlug, setCategorySlug] = useState('')
  const [searchWindowMinutes, setSearchWindowMinutes] = useState<SearchWindowMinutes | null>(null)

  const mutation = useMutation({
    mutationFn: startSession,
    onSuccess: (session, startedConfiguration) => {
      const { serverNow, ...practiceSession } = session

      startResearching(
        { ...practiceSession, configuration: startedConfiguration, recordingStartedAt: null },
        serverNow,
      )
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
        date: format.dateTime(new Date(quota.renewsAt), {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
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
            <form action={signOut}>
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
