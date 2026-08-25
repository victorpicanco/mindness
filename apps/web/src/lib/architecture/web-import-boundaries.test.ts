import { ESLint } from 'eslint'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../../../../..')

async function restrictedImportMessages(
  code: string,
  filePath: string,
): Promise<readonly string[]> {
  const eslint = new ESLint({
    cwd: REPOSITORY_ROOT,
    overrideConfigFile: resolve(REPOSITORY_ROOT, 'eslint.config.js'),
  })
  const [result] = await eslint.lintText(code, { filePath: resolve(REPOSITORY_ROOT, filePath) })

  return (
    result?.messages
      .filter((message) => message.ruleId === 'no-restricted-imports')
      .map((message) => message.message) ?? []
  )
}

describe('web import boundaries', () => {
  it('keeps components independent from route internals', async () => {
    const messages = await restrictedImportMessages(
      "import '@/app/auth/sign-out/actions'",
      'apps/web/src/components/practice/config-form/index.tsx',
    )

    expect(messages).toContainEqual(expect.stringContaining('routes'))
  }, 10_000)

  it('keeps lib independent from app, components and stores', async () => {
    const messages = await restrictedImportMessages(
      "import '@/components/ui/button'\nimport '@/stores/practice-session/store'",
      'apps/web/src/lib/api/api-error.ts',
    )

    expect(messages).toHaveLength(2)
  })

  it('keeps UI primitives independent from feature components', async () => {
    const messages = await restrictedImportMessages(
      "import '@/components/practice/session-recorder'",
      'apps/web/src/components/ui/button/index.tsx',
    )

    expect(messages).toContainEqual(expect.stringContaining('UI primitives'))
  })
})
