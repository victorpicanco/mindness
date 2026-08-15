import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/tests/e2e/**/index.test.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    passWithNoTests: true,
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
  },
})
