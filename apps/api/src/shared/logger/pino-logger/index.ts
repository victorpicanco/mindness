import pino from 'pino'
import type { DestinationStream, Logger, LoggerOptions } from 'pino'

export interface LoggerConfig {
  readonly level: string
  readonly pretty: boolean
}

const REDACT_PATHS = [
  'authorization',
  '*.authorization',
  '*.*.authorization',
  'cookie',
  '*.cookie',
  '*.*.cookie',
  'token',
  '*.token',
  'apikey',
  '*.apikey',
  'password',
  '*.password',
  'signedUrl',
  '*.signedUrl',
  'req.headers.authorization',
  'req.headers.cookie',
]

export function createLogger(config: LoggerConfig, destination?: DestinationStream): Logger {
  const options: LoggerOptions = {
    level: config.level,
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
  }

  if (config.pretty) {
    return pino({ ...options, transport: { target: 'pino-pretty' } })
  }

  return pino(options, destination)
}
