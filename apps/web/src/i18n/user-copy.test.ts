import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = join(import.meta.dirname, '..')

function sourceFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name)

    if (entry.isDirectory()) {
      return entry.name === 'i18n' ? [] : sourceFiles(entryPath)
    }

    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) return []

    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [entryPath] : []
  })
}

const USER_COPY_PATTERNS = [
  />(?:[A-Za-zÀ-ÿ][^<{]*)</u,
  /\b(?:aria-label|description|error|label|placeholder)=["'][^"'{]/u,
  /status:\s*['"](?:error|success|validation-error)['"],[\s\S]{0,80}message:\s*['"]/u,
]

describe('user-visible copy', () => {
  it('is declared only in i18n message catalogs', () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((file) => {
      const source = readFileSync(file, 'utf8')

      return USER_COPY_PATTERNS.some((pattern) => pattern.test(source)) ? [file] : []
    })

    expect(violations).toEqual([])
  })
})
