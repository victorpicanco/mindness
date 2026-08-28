import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import {
  sessionHistoryMetaSchema,
  sessionHistorySchema,
  type SessionHistoryItem,
} from '@/lib/api/contracts/sessions'
import { apiFetchWithMeta } from '@/lib/api/server-client'
import { sessionPath } from '@/lib/navigation/session-routes'

interface HistoryPageProps {
  readonly searchParams: Promise<{ readonly cursor?: string | readonly string[] }>
}

function historyPath(cursor: string | undefined): string {
  if (cursor === undefined) return '/sessions'

  return `/sessions?cursor=${encodeURIComponent(cursor)}`
}

function isCompletedSession(session: SessionHistoryItem): boolean {
  return session.state === 'completed'
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const [{ cursor }, t] = await Promise.all([searchParams, getTranslations('home.history')])
  const pageCursor = typeof cursor === 'string' ? cursor : undefined
  const history = await apiFetchWithMeta(historyPath(pageCursor), {
    cache: 'no-store',
    metaSchema: sessionHistoryMetaSchema,
    schema: sessionHistorySchema,
  })

  if (history.data.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center text-center">
          <h1 className="font-(family-name:--font-buenard) text-3xl leading-tight tracking-tight sm:text-4xl">
            {t('emptyTitle')}
          </h1>
          <p className="mt-4 max-w-lg text-text-muted">{t('emptyDescription')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface px-6 py-10">
      <main className="mx-auto w-full max-w-3xl">
        <h1 className="font-(family-name:--font-buenard) text-3xl leading-tight tracking-tight sm:text-4xl">
          {t('title')}
        </h1>
        <ol className="mt-8 space-y-3">
          {history.data.map((session) => (
            <li key={session.sessionId}>
              <article
                className="rounded-2xl border border-border bg-surface-raised px-5 py-4"
                data-session-state={session.state}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {isCompletedSession(session) ? (
                      <Link
                        className="font-medium text-text hover:underline"
                        href={sessionPath(session.sessionId)}
                      >
                        {session.themeTitle ?? session.categorySlug}
                      </Link>
                    ) : (
                      <h2 className="font-medium text-text">
                        {session.themeTitle ?? session.categorySlug}
                      </h2>
                    )}
                    <p className="mt-1 text-sm text-text-muted">
                      {session.localDate} · {session.localTime}
                    </p>
                  </div>
                  <p className="text-sm text-text-muted">{t(`states.${session.state}`)}</p>
                </div>
                {session.bestOfDay ? (
                  <p className="mt-4 text-sm font-medium text-accent">{t('bestOfDay')}</p>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
        {history.meta.nextCursor === null ? null : (
          <Link
            className="mt-8 inline-flex rounded-xl border border-border px-4 py-2 text-sm font-medium text-text hover:bg-input"
            href={`/history?cursor=${history.meta.nextCursor}`}
          >
            {t('loadMore')}
          </Link>
        )}
      </main>
    </div>
  )
}
