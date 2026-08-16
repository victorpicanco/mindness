import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@scripts': path.resolve(import.meta.dirname, 'scripts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/modules/**/presentation/integration/**/index.test.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    globalSetup: ['./src/tests/postgres-container.ts'],
    passWithNoTests: true,
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
  },
})
