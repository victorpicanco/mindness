import 'dotenv/config'

import { loadConfig } from '@/config.js'
import { buildApp } from '@/shared/http/build-app/index.js'
import { registerHealthRoute } from '@/shared/http/health-route/index.js'
import { createLogger } from '@/shared/logger/pino-logger/index.js'

const config = loadConfig(process.env)
const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv !== 'production' })
const app = buildApp({ logger })

registerHealthRoute(app)

await app.listen({ port: config.workerHealthPort })
