import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = resolve(import.meta.dirname, '../..')

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(resolve(SOURCE_ROOT, path))
    return true
  } catch {
    return false
  }
}

describe('auth organization', () => {
  it('has no standalone sign-in/sign-up screens, only the in-app authentication dialog', async () => {
    await expect(pathExists('app/(public)/auth/sign-in')).resolves.toBe(false)
    await expect(pathExists('app/(public)/auth/sign-up')).resolves.toBe(false)
    await expect(pathExists('components/auth/sign-in-screen')).resolves.toBe(false)
    await expect(pathExists('components/auth/sign-up-screen')).resolves.toBe(false)
    await expect(pathExists('components/auth/authentication-dialog/index.tsx')).resolves.toBe(true)
  })

  it('keeps public auth routes separate from shared auth code', async () => {
    await expect(pathExists('app/auth')).resolves.toBe(false)
    await expect(pathExists('components/auth/page-shell/index.tsx')).resolves.toBe(true)
    await expect(pathExists('lib/auth/form-validation/index.ts')).resolves.toBe(true)
  })
})
