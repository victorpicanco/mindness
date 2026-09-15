import { NextIntlClientProvider } from 'next-intl'
import { Suspense, type ReactNode } from 'react'

import { ApplicationLayout } from '@/app/_components/application-layout'
import { RouteLoading } from '@/components/layouts/route-loading'
import { authenticatedClientMessages } from '@/i18n/client-messages'

interface PracticeLayoutProps {
  readonly children: ReactNode
}

export default function PracticeLayout({ children }: PracticeLayoutProps) {
  return (
    <NextIntlClientProvider messages={authenticatedClientMessages}>
      <Suspense fallback={<RouteLoading />}>
        <ApplicationLayout requireAuthentication={false}>{children}</ApplicationLayout>
      </Suspense>
    </NextIntlClientProvider>
  )
}
