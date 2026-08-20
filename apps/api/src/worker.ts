import 'dotenv/config'

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import type { SweepExpiredSessionsUseCase } from '@/modules/sessions/application/use-cases/sweep-expired-sessions/index.js'
import { loadConfig } from '@/config.js'
import { createAccountsContainer } from '@/modules/accounts/composition/container.js'
import { createQuotaContainer } from '@/modules/quota/composition/container.js'
import {
  createSessionsContainer,
  type SessionsSupabaseDatabase,
} from '@/modules/sessions/composition/container.js'
import { createThemesContainer } from '@/modules/themes/composition/container.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { registerHealthRoute } from '@/shared/http/health-route/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { InProcessEventBus } from '@/shared/messaging/in-process-event-bus/index.js'
import { SystemClock } from '@/shared/time/system-clock/index.js'

// D-04 requires expired in-progress sessions to be swept at least once per minute.
export const SWEEP_INTERVAL_MS = 60_000

type SweepExpiredSessions = Pick<SweepExpiredSessionsUseCase, 'execute'>

export interface WorkerSweepLogger {
  error(object: { readonly err: unknown }, message: string): void
}

export interface WorkerSweepDeps {
  readonly sweepExpiredSessions: SweepExpiredSessions
  readonly logger: WorkerSweepLogger
  readonly schedule?: (callback: () => void, interval: number) => void
}

async function sweepExpiredSessions(deps: WorkerSweepDeps): Promise<void> {
  try {
    await deps.sweepExpiredSessions.execute()
  } catch (error) {
    deps.logger.error({ err: error }, 'Failed to sweep expired sessions')
  }
}

export function registerExpiredSessionSweep(deps: WorkerSweepDeps): void {
  const schedule = deps.schedule ?? ((callback, interval) => void setInterval(callback, interval))

  schedule(() => {
    void sweepExpiredSessions(deps)
  }, SWEEP_INTERVAL_MS)
}

export async function startWorker(): Promise<void> {
  const config = loadConfig(process.env)
  const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv !== 'production' })
  const app = buildApp({ logger })
  const prisma = createPrismaClient({
    databaseUrl: config.databaseUrl,
    logQueries: config.nodeEnv !== 'production',
  })
  const eventBus = new InProcessEventBus(logger)
  const clock = new SystemClock()
  const idGenerator = new UuidGenerator()
  const accountsContainer = createAccountsContainer({
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
    config: {
      consentVersion: config.accountsConsentVersion,
      publicApiUrl: config.publicApiUrl,
      secureCookies: config.nodeEnv === 'production',
      supabaseUrl: config.supabaseUrl,
      supabaseSecretKey: config.supabaseSecretKey,
      emailConfirmationRedirectUrl: config.emailConfirmationRedirectUrl,
    },
  })
  const themesContainer = createThemesContainer({
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
  })
  const quotaContainer = createQuotaContainer({
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
    accountsFacade: accountsContainer.facade,
  })
  const sessionsContainer = createSessionsContainer({
    prisma,
    clock,
    eventPublisher: eventBus,
    idGenerator,
    accountsFacade: accountsContainer.facade,
    themesFacade: themesContainer.publicApi,
    quotaFacade: quotaContainer.publicApi,
    supabase: createClient<SessionsSupabaseDatabase>(config.supabaseUrl, config.supabaseSecretKey),
  })

  registerHealthRoute(app)
  registerExpiredSessionSweep({
    sweepExpiredSessions: sessionsContainer.useCases.sweepExpiredSessions,
    logger,
  })

  await app.listen({ port: config.workerHealthPort })
}

function isWorkerEntrypoint(): boolean {
  const scriptPath = process.argv[1]
  return scriptPath !== undefined && resolve(scriptPath) === fileURLToPath(import.meta.url)
}

if (isWorkerEntrypoint()) await startWorker()
