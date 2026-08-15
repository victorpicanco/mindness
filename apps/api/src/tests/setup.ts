import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

const ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1']

class NetworkGuardError extends InfrastructureError {
  readonly code = 'shared.NETWORK_GUARD_BLOCKED'
}

function resolveHost(input: string | URL | Request): string {
  if (typeof input === 'string') return new URL(input).hostname
  if (input instanceof URL) return input.hostname
  return new URL(input.url).hostname
}

const originalFetch = globalThis.fetch

async function guardedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const host = resolveHost(input)

  if (!ALLOWED_HOSTS.includes(host)) {
    throw new NetworkGuardError(`Blocked network call to external host "${host}" during test run`, {
      context: { host },
    })
  }

  return originalFetch(input, init)
}

globalThis.fetch = guardedFetch
