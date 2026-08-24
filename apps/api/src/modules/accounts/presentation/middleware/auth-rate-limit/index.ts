import fastifyRateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'

import { RateLimitedError } from '@/modules/accounts/domain/errors/rate-limited-error/index.js'

export interface AuthRateLimitOptions {
  readonly max: number
  readonly timeWindowMs: number
}

export async function registerAuthRateLimit(
  app: FastifyInstance,
  options: AuthRateLimitOptions,
): Promise<void> {
  await app.register(fastifyRateLimit, {
    global: false,
    max: options.max,
    timeWindow: options.timeWindowMs,
    // The plugin throws whatever this builder returns, so returning a BaseError
    // keeps the shared error handler as the single owner of the HTTP envelope.
    errorResponseBuilder: () => new RateLimitedError('authentication'),
  })
}
