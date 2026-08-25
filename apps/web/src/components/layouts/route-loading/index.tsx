'use client'

import { Spinner } from '@/components/ui/spinner'

export function RouteLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface text-text">
      <Spinner />
    </main>
  )
}
