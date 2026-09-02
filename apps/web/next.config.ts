import { join } from 'node:path'

import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin({
  experimental: {
    messages: {
      format: 'json',
      locales: ['pt-BR'],
      path: './src/i18n/messages/pt-BR',
      precompile: true,
    },
  },
})

const nextConfig: NextConfig = {
  cacheComponents: true,
  output: 'standalone',
  // The Dockerfile builds from the monorepo root, so file tracing has to start
  // there to reach the pnpm store symlinks under the workspace node_modules.
  outputFileTracingRoot: join(import.meta.dirname, '../..'),
  devIndicators: false,
  images: {
    qualities: [90],
  },
  reactCompiler: true,
}

export default withNextIntl(nextConfig)
