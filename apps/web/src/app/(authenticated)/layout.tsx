import { NextIntlClientProvider } from 'next-intl'
import { Suspense, type ReactNode } from 'react'

import { ApplicationLayout } from '@/app/_components/application-layout'
import { RouteLoading } from '@/components/layouts/route-loading'
import { authenticatedClientMessages } from '@/i18n/client-messages'

interface AuthenticatedLayoutProps {
  readonly children: ReactNode
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <NextIntlClientProvider messages={authenticatedClientMessages}>
      <Suspense fallback={<RouteLoading />}>
        <ApplicationLayout requireAuthentication>{children}</ApplicationLayout>
      </Suspense>
    </NextIntlClientProvider>
  )
}
