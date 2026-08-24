import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { ThemeProvider } from '@/components/providers/theme-provider'

import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Mindness',
  description: 'Practice mindful communication.',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
