import 'server-only'

import { PostHog } from 'posthog-node'
import type { EventMessage, IdentifyMessage } from 'posthog-node'

export interface AnalyticsClient {
  capture(message: EventMessage): void
  identify(message: IdentifyMessage): void
  flush(): Promise<void>
}

type EnvSource = Readonly<Partial<Record<string, string>>>

interface CreatePostHogClientOptions {
  readonly env?: EnvSource
  readonly createClient?: (projectToken: string, host: string | undefined) => AnalyticsClient
}

const noopClient: AnalyticsClient = {
  capture: () => undefined,
  identify: () => undefined,
  flush: () => Promise.resolve(),
}

function createRealPostHogClient(projectToken: string, host: string | undefined): AnalyticsClient {
  return new PostHog(projectToken, {
    ...(host === undefined ? {} : { host }),
    enableExceptionAutocapture: true,
    flushAt: 1,
    flushInterval: 0,
  })
}

function blankToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value
}

export function createPostHogClient({
  env = process.env,
  createClient = createRealPostHogClient,
}: CreatePostHogClientOptions = {}): AnalyticsClient {
  const projectToken = blankToUndefined(env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN)

  if (env.NODE_ENV === 'development' && projectToken === undefined) {
    console.error(
      'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
    )
  }

  return projectToken === undefined
    ? noopClient
    : createClient(projectToken, blankToUndefined(env.NEXT_PUBLIC_POSTHOG_HOST))
}
