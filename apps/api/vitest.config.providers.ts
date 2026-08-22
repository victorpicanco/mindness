import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/tests/providers/**/index.test.ts'],
    passWithNoTests: true,
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
})
