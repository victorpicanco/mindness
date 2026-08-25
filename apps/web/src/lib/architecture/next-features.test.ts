import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = resolve(import.meta.dirname, '../../..')

describe('Next.js rendering features', () => {
  it('enables the React Compiler and component caching explicitly', async () => {
    const config = await readFile(resolve(WEB_ROOT, 'next.config.ts'), 'utf8')

    expect(config).toMatch(/reactCompiler:\s*true/u)
    expect(config).toMatch(/cacheComponents:\s*true/u)
  })

  it('does not load the removed icon font stylesheet', async () => {
    const rootLayout = await readFile(resolve(WEB_ROOT, 'src/app/layout.tsx'), 'utf8')

    expect(rootLayout).not.toContain('use.hugeicons.com')
  })
})
