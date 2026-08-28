import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Buenard } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Suspense, type ReactNode } from 'react'

import { rootClientMessages } from '@/i18n/client-messages'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { ToastProvider } from '@/components/providers/toast-provider'

import './globals.css'
import { Providers } from './providers'

const buenard = Buenard({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-buenard',
  weight: ['400', '700'],
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.metadata')

  return {
    title: t('title'),
    description: t('description'),
  }
}

const themeInitializationScript = `(() => {
  try {
    const storedTheme = localStorage.getItem('mindness-theme')
    if (!storedTheme) return

    const parsedTheme = JSON.parse(storedTheme)
    const theme = parsedTheme?.state?.theme
    document.documentElement.classList.toggle('dark', theme === 'dark')
  } catch {}
})()`

interface RootLayoutProps {
  readonly children: ReactNode
}

async function ThemeInitializationScript() {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
      nonce={nonce}
      suppressHydrationWarning
    />
  )
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html className={buenard.variable} lang="pt-BR" suppressHydrationWarning>
      <head>
        <Suspense fallback={null}>
          <ThemeInitializationScript />
        </Suspense>
      </head>
      <body>
        <NextIntlClientProvider messages={rootClientMessages}>
          <Providers>
            <ThemeProvider>
              {children}
              <ToastProvider />
            </ThemeProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
