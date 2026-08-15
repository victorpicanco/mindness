import { Writable } from 'node:stream'

import type { DestinationStream } from 'pino'
import { describe, expect, it } from 'vitest'

import { createLogger } from './index.js'

function createCapturingDestination(): { destination: DestinationStream; lines: () => string[] } {
  const chunks: string[] = []
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString('utf8'))
      callback()
    },
  })

  return { destination, lines: () => chunks.join('').split('\n').filter(Boolean) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseLogLine(line: string | undefined): Record<string, unknown> {
  if (line === undefined) throw new TypeError('expected a log line')
  const parsed: unknown = JSON.parse(line)
  if (!isRecord(parsed)) throw new TypeError('expected the log line to parse into an object')
  return parsed
}

describe('createLogger', () => {
  it('redacts sensitive fields with [Redacted]', () => {
    const { destination, lines } = createCapturingDestination()
    const logger = createLogger({ level: 'info', pretty: false }, destination)

    logger.info(
      {
        authorization: 'Bearer secret',
        token: 'abc',
        apikey: 'xyz',
        password: 'p',
        cookie: 'c',
        signedUrl: 'u',
      },
      'event',
    )

    const parsed = parseLogLine(lines()[0])

    expect(parsed.authorization).toBe('[Redacted]')
    expect(parsed.token).toBe('[Redacted]')
    expect(parsed.apikey).toBe('[Redacted]')
    expect(parsed.password).toBe('[Redacted]')
    expect(parsed.cookie).toBe('[Redacted]')
    expect(parsed.signedUrl).toBe('[Redacted]')
  })

  it('redacts nested sensitive fields', () => {
    const { destination, lines } = createCapturingDestination()
    const logger = createLogger({ level: 'info', pretty: false }, destination)

    logger.info({ req: { headers: { authorization: 'Bearer secret', cookie: 'c' } } }, 'event')

    const parsed = parseLogLine(lines()[0])
    if (!isRecord(parsed.req)) throw new TypeError('expected req to be an object')
    if (!isRecord(parsed.req.headers)) throw new TypeError('expected req.headers to be an object')

    expect(parsed.req.headers.authorization).toBe('[Redacted]')
    expect(parsed.req.headers.cookie).toBe('[Redacted]')
  })

  it('leaves non-sensitive fields intact', () => {
    const { destination, lines } = createCapturingDestination()
    const logger = createLogger({ level: 'info', pretty: false }, destination)

    logger.info({ processingId: 'p-1', ownerId: 'o-1', requestId: 'r-1' }, 'event')

    const parsed = parseLogLine(lines()[0])

    expect(parsed.processingId).toBe('p-1')
    expect(parsed.ownerId).toBe('o-1')
    expect(parsed.requestId).toBe('r-1')
  })
})
