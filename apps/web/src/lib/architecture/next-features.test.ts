import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = resolve(import.meta.dirname, '../../..')

async function readWebFile(path: string): Promise<string> {
  return readFile(resolve(WEB_ROOT, path), 'utf8')
}

describe('Next.js rendering features', () => {
  it('enables the React Compiler and component caching explicitly', async () => {
    const config = await readWebFile('next.config.ts')

    expect(config).toMatch(/reactCompiler:\s*true/u)
    expect(config).toMatch(/cacheComponents:\s*true/u)
  })

  it('caches the theme catalogue instead of refetching it on every home render', async () => {
    const homePage = await readWebFile('src/app/(authenticated)/page.tsx')

    expect(homePage).toContain("'use cache: private'")
    expect(homePage).toMatch(/cacheLife\('hours'\)/u)
    expect(homePage).not.toMatch(/theme-categories[\s\S]{0,120}no-store/u)
  })

  it('deduplicates authenticated session data through shared request helpers', async () => {
    const layout = await readWebFile('src/app/(authenticated)/layout.tsx')
    const homePage = await readWebFile('src/app/(authenticated)/page.tsx')
    const sessionPage = await readWebFile('src/app/(authenticated)/sessions/[sessionId]/page.tsx')

    for (const source of [layout, homePage, sessionPage]) {
      expect(source).toContain('@/lib/api/authenticated-session-data')
      expect(source).not.toContain("apiFetch('/sessions/active'")
    }
  })

  it('drives the auth forms with the React form action instead of a manual submit handler', async () => {
    const authForm = await readWebFile('src/components/auth/use-auth-form/index.ts')

    expect(authForm).toMatch(/useActionState\(action,\s*initialAuthActionState/u)
    expect(authForm).not.toContain('preventDefault')
    expect(authForm).not.toContain('awaitCaptchaToken')
    expect(authForm).not.toContain('formData.set')
  })

  it('does not load the removed icon font stylesheet', async () => {
    const rootLayout = await readWebFile('src/app/layout.tsx')

    expect(rootLayout).not.toContain('use.hugeicons.com')
  })
})
