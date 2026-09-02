import { describe, expect, it } from 'vitest'
import pino from 'pino'

import { buildApp } from './index.js'

const FORWARDED_CLIENT_IP = '203.0.113.9'

async function resolveClientIp(trustProxy: boolean): Promise<string> {
  const app = buildApp({ logger: pino({ level: 'silent' }), trustProxy })
  app.get('/ip', (request) => ({ ip: request.ip }))

  const response = await app.inject({
    method: 'GET',
    url: '/ip',
    headers: { 'x-forwarded-for': FORWARDED_CLIENT_IP },
  })
  await app.close()

  const body: unknown = response.json()
  if (typeof body !== 'object' || body === null || !('ip' in body)) return ''

  const ip: unknown = body.ip
  return typeof ip === 'string' ? ip : ''
}

describe('buildApp', () => {
  it('reads the client ip from the forwarded header when the proxy is trusted', async () => {
    expect(await resolveClientIp(true)).toBe(FORWARDED_CLIENT_IP)
  })

  it('ignores the forwarded header when no proxy is trusted', async () => {
    expect(await resolveClientIp(false)).not.toBe(FORWARDED_CLIENT_IP)
  })
})
