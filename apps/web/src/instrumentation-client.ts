import posthog from 'posthog-js'

if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  console.error(
    'NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured',
  )
}

if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_POSTHOG_HOST) {
  console.error(
    'NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured',
  )
}

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-01-30',
    capture_exceptions: true,
    debug: process.env.NODE_ENV === 'development',
  })
}
