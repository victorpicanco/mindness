import { describe, expect, it } from 'vitest'

import { DatabaseError } from '@/shared/errors/database-error/index.js'

import { assertConnectionTls } from './index.js'

const BASE_URL = 'postgresql://user:pass@aws-0-sa-east-1.pooler.supabase.com:5432/postgres'

const readable = { isReadable: (): boolean => true }
const unreadable = { isReadable: (): boolean => false }

describe('assertConnectionTls', () => {
  it('accepts a url that verifies the chain against a readable root certificate', () => {
    expect(() =>
      assertConnectionTls(
        `${BASE_URL}?sslmode=verify-full&sslrootcert=/app/certs/ca.crt`,
        readable,
      ),
    ).not.toThrow()
  })

  it('accepts a url that asks for no tls, which is what the local test container serves', () => {
    expect(() => assertConnectionTls(BASE_URL, unreadable)).not.toThrow()
  })

  it('accepts sslmode=require, which the driver verifies against the public trust store', () => {
    expect(() => assertConnectionTls(`${BASE_URL}?sslmode=require`, unreadable)).not.toThrow()
  })

  it('rejects a verifying sslmode that names no root certificate', () => {
    expect(() => assertConnectionTls(`${BASE_URL}?sslmode=verify-full`, readable)).toThrow(
      DatabaseError,
    )
  })

  it('rejects sslmode=verify-ca without a root certificate as well', () => {
    expect(() => assertConnectionTls(`${BASE_URL}?sslmode=verify-ca`, readable)).toThrow(
      DatabaseError,
    )
  })

  it('rejects a root certificate the process cannot read', () => {
    expect(() =>
      assertConnectionTls(
        `${BASE_URL}?sslmode=verify-full&sslrootcert=/app/certs/ca.crt`,
        unreadable,
      ),
    ).toThrow(DatabaseError)
  })

  it('reports the unreadable path in the error context', () => {
    try {
      assertConnectionTls(
        `${BASE_URL}?sslmode=verify-full&sslrootcert=/app/certs/ca.crt`,
        unreadable,
      )
      expect.unreachable('the unreadable certificate should have been rejected')
    } catch (error) {
      if (!(error instanceof DatabaseError)) throw error
      expect(error.context).toEqual({ sslRootCertificate: '/app/certs/ca.crt' })
    }
  })

  it('rejects a connection string that is not a url', () => {
    expect(() => assertConnectionTls('not-a-url', readable)).toThrow(DatabaseError)
  })
})
