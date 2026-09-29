import { PostHog } from 'posthog-node'

import { BaseError } from '@/shared/errors/base-error/index.js'

type ErrorReportProperties = Readonly<Record<string, unknown>>

export interface ErrorReporter {
  report(error: unknown, properties: ErrorReportProperties): void
  shutdown(): Promise<void>
}

export interface ErrorTrackingClient {
  captureException(
    error: unknown,
    distinctId?: string,
    additionalProperties?: Record<string | number, unknown>,
  ): void
  shutdown(): Promise<void>
}

interface CreateErrorReporterOptions {
  readonly projectToken: string | null
  readonly host: string | null
  readonly createClient?: (projectToken: string, host: string | null) => ErrorTrackingClient
}

const noopReporter: ErrorReporter = {
  report: () => undefined,
  shutdown: () => Promise.resolve(),
}

function createPostHogClient(projectToken: string, host: string | null): ErrorTrackingClient {
  return new PostHog(projectToken, host === null ? {} : { host })
}

export function createErrorReporter({
  projectToken,
  host,
  createClient = createPostHogClient,
}: CreateErrorReporterOptions): ErrorReporter {
  if (projectToken === null) return noopReporter

  const client = createClient(projectToken, host)

  return {
    report: (error, properties) => {
      client.captureException(
        error,
        undefined,
        error instanceof BaseError
          ? { ...properties, error_code: error.code, error_context: error.context }
          : { ...properties },
      )
    },
    shutdown: () => client.shutdown(),
  }
}
