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
  rewrites() {
    return Promise.resolve([
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ])
  },
  skipTrailingSlashRedirect: true,
}

export default withNextIntl(nextConfig)
