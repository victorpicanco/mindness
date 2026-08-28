import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'

import { publicClientMessages } from '@/i18n/client-messages'

interface PublicLayoutProps {
  readonly children: ReactNode
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return <NextIntlClientProvider messages={publicClientMessages}>{children}</NextIntlClientProvider>
}
