'use client'

import { useEffect, useRef } from 'react'

import { browserAnalyticsClient } from '@/lib/analytics/browser-client'

interface AnonymousDistinctIdFieldProps {
  readonly getDistinctId?: () => string
}

export function AnonymousDistinctIdField({ getDistinctId }: AnonymousDistinctIdFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = inputRef.current
    if (input === null) return

    input.value =
      getDistinctId === undefined ? browserAnalyticsClient.getDistinctId() : getDistinctId()
  }, [getDistinctId])

  return (
    <input
      data-testid="anonymous-distinct-id"
      name="anonymousDistinctId"
      ref={inputRef}
      type="hidden"
    />
  )
}
