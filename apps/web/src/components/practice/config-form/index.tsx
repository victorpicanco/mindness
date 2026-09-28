'use client'

import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useRef, useState, type FormEvent } from 'react'

import {
  AuthenticationDialog,
  type AuthenticationMode,
} from '@/components/auth/authentication-dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { apiErrorDetails } from '@/lib/api/api-error'
import type { AuthFormAction, StartGuestTrialAction } from '@/lib/auth/action-state'
import { startGuestTrialAction } from '@/lib/auth/start-guest-trial'
import type { ApiErrorDescription } from '@/lib/errors/api-error-presentation'
import { showApiErrorAlert } from '@/lib/errors/show-api-error-alert'
import { showApiErrorToast } from '@/lib/errors/show-api-error-toast'
import { sessionPath } from '@/lib/navigation/session-routes'
import { bffFetch } from '@/lib/api/bff-client'
import { startedSessionSchema } from '@/lib/api/contracts/sessions'
import { usePracticeSessionStore } from '@/stores/practice-session/provider'

const DIFFICULTIES = ['easy', 'balanced', 'hard'] as const
const SEARCH_WINDOWS = [3, 4, 5] as const

const GUEST_TRIAL_CONSUMED_CODE = 'sessions.GUEST_TRIAL_CONSUMED'
const PRACTICE_NOT_ALLOWED_CODE = 'sessions.PRACTICE_NOT_ALLOWED'

type SessionDifficulty = (typeof DIFFICULTIES)[number]
type SearchWindowMinutes = (typeof SEARCH_WINDOWS)[number]

export interface PracticeCategory {
  readonly categoryId: string
  readonly name: string
  readonly slug: string
}

export interface StartSessionInput {
  readonly categorySlug: string
  readonly difficulty: SessionDifficulty
  readonly searchWindowMinutes: SearchWindowMinutes
}

interface StartedSession {
  readonly createdAt: string
  readonly expiresAt: string
  readonly researchEndsAt: string
  readonly serverNow: string
  readonly sessionId: string
  readonly themeId: string
  readonly themeTitle: string
}

export type StartSessionRequest = (input: StartSessionInput) => Promise<StartedSession>

export type SignOutAction = () => void | Promise<void>

export type PracticeViewer = 'guest' | 'registered' | 'visitor'

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
  readonly initialAuthenticationError?: ApiErrorDescription | undefined
  readonly initialAuthenticationMode?: AuthenticationMode | null
  readonly isTrialConsumed?: boolean
  readonly onSessionStarted?: (sessionId: string) => void
  readonly passwordUpdated?: boolean
  readonly signInAction?: AuthFormAction
  readonly signOut: SignOutAction
  readonly signUpAction?: AuthFormAction
  readonly startGuestTrial?: StartGuestTrialAction
  readonly startSession?: StartSessionRequest
  readonly viewer: PracticeViewer
}

export function PracticeConfigFormWithNavigation(
  props: Pick<
    PracticeConfigFormProps,
    | 'categories'
    | 'initialAuthenticationError'
    | 'initialAuthenticationMode'
    | 'isTrialConsumed'
    | 'passwordUpdated'
    | 'signInAction'
    | 'signOut'
    | 'signUpAction'
    | 'startSession'
    | 'viewer'
  >,
) {
  const router = useRouter()

  return (
    <PracticeConfigForm
      {...props}
      onSessionStarted={(sessionId) => {
        router.push(sessionPath(sessionId))
        router.refresh()
      }}
    />
  )
}

export function PracticeConfigForm({
  categories,
  initialAuthenticationError,
  initialAuthenticationMode = null,
  isTrialConsumed = false,
  onSessionStarted,
  passwordUpdated = false,
  signInAction,
  signOut,
  signUpAction,
  startGuestTrial = startGuestTrialAction,
  startSession = requestSessionStart,
  viewer,
}: PracticeConfigFormProps) {
  const t = useTranslations('home.practice')
  const translate = useTranslations()
  const startResearching = usePracticeSessionStore((state) => state.startResearching)
  const [difficulty, setDifficulty] = useState<SessionDifficulty | null>(null)
  const [categorySlug, setCategorySlug] = useState('')
  const [searchWindowMinutes, setSearchWindowMinutes] = useState<SearchWindowMinutes | null>(null)
  const [authenticationMode, setAuthenticationMode] = useState<AuthenticationMode | null>(
    initialAuthenticationMode,
  )
  const [hasConsumedTrial, setHasConsumedTrial] = useState(isTrialConsumed)
  const startControlRef = useRef<HTMLButtonElement>(null)
  const startsAnonymousTrialRef = useRef(viewer === 'guest')

  function handleSignOut() {
    posthog.capture('sign_out')
    posthog.reset()

    return signOut()
  }

  const mutation = useMutation({
    meta: { announcesOwnFailure: true },
    mutationFn: startSession,
    onError: (error) => {
      const details = apiErrorDetails(error)

      if (details.code === GUEST_TRIAL_CONSUMED_CODE) {
        posthog.capture('anonymous_trial_blocked')
        setHasConsumedTrial(true)
        setAuthenticationMode('sign-in')

        return
      }

      if (details.code === PRACTICE_NOT_ALLOWED_CODE) {
        posthog.capture('practice_not_allowed')
        showApiErrorAlert(details, translate, [
          { label: t('signOutToRetry'), onSelect: () => void handleSignOut() },
        ])

        return
      }

      showApiErrorToast(details, translate)
      showApiErrorAlert(details, translate)
    },
    onSuccess: (session, startedConfiguration) => {
      const { serverNow, ...practiceSession } = session

      posthog.capture('session_started', {
        category_slug: startedConfiguration.categorySlug,
        difficulty: startedConfiguration.difficulty,
        search_window_minutes: startedConfiguration.searchWindowMinutes,
        session_id: session.sessionId,
      })
      if (startsAnonymousTrialRef.current) posthog.capture('anonymous_trial_started')

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

    if (viewer === 'visitor') {
      setAuthenticationMode('sign-in')

      return
    }

    mutation.mutate(configuration)
  }

  function startPracticeAsGuest() {
    startsAnonymousTrialRef.current = true
    setAuthenticationMode(null)

    if (configuration !== null) mutation.mutate(configuration)
  }

  function closeAuthentication() {
    setAuthenticationMode(null)
    startControlRef.current?.focus()
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
          ref={startControlRef}
          size="lg"
          type="submit"
        >
          {t('startSession')}
        </Button>
      </form>
      <AuthenticationDialog
        canContinueWithoutAccount={!hasConsumedTrial}
        initialError={initialAuthenticationError}
        mode={authenticationMode}
        onClose={closeAuthentication}
        onGuestTrialAccountRequired={() => setHasConsumedTrial(true)}
        onGuestTrialStarted={startPracticeAsGuest}
        onModeChange={setAuthenticationMode}
        passwordUpdated={passwordUpdated}
        signInAction={signInAction}
        signUpAction={signUpAction}
        startGuestTrial={startGuestTrial}
      />
    </div>
  )
}
