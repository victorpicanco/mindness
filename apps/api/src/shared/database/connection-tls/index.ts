import { accessSync, constants } from 'node:fs'

import { DatabaseError } from '@/shared/errors/database-error/index.js'

// The driver adapter runs on node-postgres, whose `verify-ca` and `verify-full` check the chain
// against the public trust store unless `sslrootcert` names one. Supabase signs the pooler with a
// private root, so a string that verifies without naming that root fails on the first query
// instead of at boot.
const VERIFYING_SSL_MODES = new Set(['verify-ca', 'verify-full'])

export interface ConnectionTlsDependencies {
  readonly isReadable: (path: string) => boolean
}

function isReadableFile(path: string): boolean {
  try {
    accessSync(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

function parseConnectionString(databaseUrl: string): URL {
  try {
    return new URL(databaseUrl)
  } catch (cause) {
    throw new DatabaseError('The database url is not a valid connection string', { cause })
  }
}

export function assertConnectionTls(
  databaseUrl: string,
  dependencies: ConnectionTlsDependencies = { isReadable: isReadableFile },
): void {
  const parameters = parseConnectionString(databaseUrl).searchParams
  const sslMode = parameters.get('sslmode')
  const sslRootCertificate = parameters.get('sslrootcert')

  if (sslMode !== null && VERIFYING_SSL_MODES.has(sslMode) && sslRootCertificate === null) {
    throw new DatabaseError('The database url verifies tls but names no root certificate', {
      context: { sslMode },
    })
  }

  if (sslRootCertificate !== null && !dependencies.isReadable(sslRootCertificate)) {
    throw new DatabaseError('The database root certificate is missing or unreadable', {
      context: { sslRootCertificate },
    })
  }
}
