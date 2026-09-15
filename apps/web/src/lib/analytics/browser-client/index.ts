'use client'

import posthog from 'posthog-js'

export type BrowserAnalyticsProperties = Readonly<Record<string, boolean | number | string>>

export interface BrowserAnalyticsClient {
  capture(event: string, properties?: BrowserAnalyticsProperties): void
  getDistinctId(): string
  reset(): void
}

export const browserAnalyticsClient: BrowserAnalyticsClient = {
  capture: (event, properties) => {
    posthog.capture(event, properties)
  },
  getDistinctId: () =>
    typeof posthog.get_distinct_id === 'function' ? posthog.get_distinct_id() : '',
  reset: () => {
    posthog.reset()
  },
}
