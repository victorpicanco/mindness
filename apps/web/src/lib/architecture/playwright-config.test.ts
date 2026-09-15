import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

const configSource = readFile(new URL('../../../playwright.config.ts', import.meta.url), 'utf8')

describe('Playwright configuration', () => {
  it('runs the smoke flow in desktop Chromium and mobile Safari', async () => {
    await expect(configSource).resolves.toContain("name: 'desktop-chromium'")
    await expect(configSource).resolves.toContain("name: 'mobile-safari'")
  })

  it('owns both API and web server lifecycles', async () => {
    const source = await configSource

    expect(source).toContain('webServer: [')
    expect(source).toContain('test:e2e:server')
    expect(source).toContain('pnpm build')
  })
})
