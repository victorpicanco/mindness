import 'dotenv/config'

import { loadConfig } from '@/config.js'
import { registerAccountsModule } from '@/modules/accounts/index.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { registerHealthRoute } from '@/shared/http/health-route/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'
import { InProcessEventBus } from '@/shared/messaging/in-process-event-bus/index.js'

const config = loadConfig(process.env)
const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv !== 'production' })
const app = buildApp({ logger })

registerHealthRoute(app)

const prisma = createPrismaClient({
  databaseUrl: config.databaseUrl,
  logQueries: config.nodeEnv !== 'production',
})
const eventBus = new InProcessEventBus(logger)

await registerAccountsModule(app, {
  prisma,
  eventPublisher: eventBus,
  config: {
    consentVersion: config.accountsConsentVersion,
    publicApiUrl: config.publicApiUrl,
    secureCookies: config.nodeEnv === 'production',
    supabaseUrl: config.supabaseUrl,
    supabaseSecretKey: config.supabaseSecretKey,
    emailConfirmationRedirectUrl: config.emailConfirmationRedirectUrl,
  },
})

await app.listen({ port: config.port })
