import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

import { ThemeProvider } from '@/components/providers/theme-provider'
import { ToastProvider } from '@/components/providers/toast-provider'

import './globals.css'
import { Providers } from './providers'

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

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>
        <NextIntlClientProvider>
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
