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
  outputFileTracingRoot: join(import.meta.dirname, '../..'),
  devIndicators: false,
  images: {
    qualities: [90],
  },
  reactCompiler: true,
}

export default withNextIntl(nextConfig)
