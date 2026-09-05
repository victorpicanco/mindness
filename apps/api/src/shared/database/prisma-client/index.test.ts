import { describe, expect, it } from 'vitest'

import { DatabaseError } from '@/shared/errors/database-error/index.js'

import { createPrismaClient } from './index.js'

describe('createPrismaClient', () => {
  it('refuses a connection string whose root certificate is not on disk', () => {
    expect(() =>
      createPrismaClient({
        databaseUrl:
          'postgresql://user:pass@db.example.com:5432/postgres?sslmode=verify-full&sslrootcert=/absent/ca.crt',
        logQueries: false,
      }),
    ).toThrow(DatabaseError)
  })

  it('builds a client for the plaintext connection string the test container serves', () => {
    expect(() =>
      createPrismaClient({
        databaseUrl: 'postgresql://user:pass@localhost:5432/postgres',
        logQueries: false,
      }),
    ).not.toThrow()
  })
})
