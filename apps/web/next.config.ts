import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: false,
  images: {
    qualities: [90],
  },
  reactCompiler: true,
}

export default withNextIntl(nextConfig)
