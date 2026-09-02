import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = resolve(import.meta.dirname, '../../..')
const APPLE_ICON_SIZE = 180

async function readWebFile(path: string): Promise<Buffer> {
  return readFile(resolve(WEB_ROOT, path))
}

function pngDimensions(file: Buffer): { readonly height: number; readonly width: number } {
  return { height: file.readUInt32BE(20), width: file.readUInt32BE(16) }
}

describe('app icons', () => {
  it('serves the sidebar logo as the app icon', async () => {
    const [appIcon, sidebarLogo] = await Promise.all([
      readWebFile('src/app/icon.svg'),
      readWebFile('public/logo-icon.svg'),
    ])

    expect(appIcon.toString('utf8')).toBe(sidebarLogo.toString('utf8'))
  })

  it('ships a favicon for browsers that do not render SVG icons', async () => {
    const favicon = await readWebFile('src/app/favicon.ico')

    expect(favicon.readUInt16LE(0)).toBe(0)
    expect(favicon.readUInt16LE(2)).toBe(1)
    expect(favicon.readUInt16LE(4)).toBeGreaterThan(0)
  })

  it('ships a square apple touch icon at the size iOS asks for', async () => {
    const appleIcon = await readWebFile('src/app/apple-icon.png')

    expect(appleIcon.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(pngDimensions(appleIcon)).toEqual({ height: APPLE_ICON_SIZE, width: APPLE_ICON_SIZE })
  })

  it('leaves the icon tags to the file convention instead of declaring them by hand', async () => {
    const rootLayout = await readWebFile('src/app/layout.tsx')

    expect(rootLayout.toString('utf8')).not.toMatch(/rel="icon"|icons:/u)
  })
})
