import 'dotenv/config'

import { createClient } from '@supabase/supabase-js'

import { loadConfig } from '@/config.js'
import { registerAccountsModule } from '@/modules/accounts/index.js'
import { registerQuotaModule } from '@/modules/quota/index.js'
import { registerSessionsModule, type SessionsSupabaseDatabase } from '@/modules/sessions/index.js'
import { registerThemesModule } from '@/modules/themes/index.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { registerHealthRoute } from '@/shared/http/health-route/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { InProcessEventBus } from '@/shared/messaging/in-process-event-bus/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { SystemClock } from '@/shared/time/system-clock/index.js'

const config = loadConfig(process.env)
const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv !== 'production' })
const app = buildApp({ logger })

registerHealthRoute(app)

const prisma = createPrismaClient({
  databaseUrl: config.databaseUrl,
  logQueries: config.nodeEnv !== 'production',
})
const eventBus = new InProcessEventBus(logger)
const clock = new SystemClock()
const idGenerator = new UuidGenerator()

const accountsContainer = await registerAccountsModule(app, {
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

const quotaContainer = registerQuotaModule(app, {
  prisma,
  clock,
  eventPublisher: eventBus,
  idGenerator,
  accountsFacade: accountsContainer.facade,
})

const themesContainer = registerThemesModule(app, {
  prisma,
  clock,
  eventPublisher: eventBus,
  idGenerator,
})

await registerSessionsModule(app, {
  prisma,
  clock,
  eventPublisher: eventBus,
  idGenerator,
  accountsFacade: accountsContainer.facade,
  themesFacade: themesContainer.publicApi,
  quotaFacade: quotaContainer.publicApi,
  supabase: createClient<SessionsSupabaseDatabase>(config.supabaseUrl, config.supabaseSecretKey),
})

await app.listen({ port: config.port })
