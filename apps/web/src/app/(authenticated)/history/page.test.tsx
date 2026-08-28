import { cleanup, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

import { DEFAULT_TIME_ZONE } from '@/i18n/request'

type ApiFetchWithMeta = <TSchema extends z.ZodType, TMetaSchema extends z.ZodType>(
  path: string,
  options: { readonly metaSchema: TMetaSchema; readonly schema: TSchema },
) => Promise<{ readonly data: z.output<TSchema>; readonly meta: z.output<TMetaSchema> }>

let respondToApi: ApiFetchWithMeta = () =>
  Promise.reject(new DOMException('The API stub was not configured.'))

vi.mock('@/lib/api/server-client', () => ({
  apiFetchWithMeta: <TSchema extends z.ZodType, TMetaSchema extends z.ZodType>(
    path: string,
    options: { readonly metaSchema: TMetaSchema; readonly schema: TSchema },
  ) => respondToApi(path, options),
}))

vi.mock('next-intl/server', () => ({
  getRequestConfig: (factory: () => unknown) => factory,
  getTranslations: () =>
    Promise.resolve((key: string) => {
      const values: Readonly<Record<string, string>> = {
        bestOfDay: 'Melhor do dia',
        emptyDescription:
          'Inicie uma sessão para praticar sua apresentação e acompanhar seu progresso.',
        emptyTitle: 'Seu progresso começa aqui',
        loadMore: 'Carregar mais',
        'states.completed': 'Concluída',
        'states.expired': 'Expirada',
        'states.failed': 'Falhou',
        'states.in_progress': 'Em andamento',
        'states.processing': 'Em processamento',
        title: 'Seu progresso',
      }

      return values[key] ?? key
    }),
}))

async function loadHistoryPage() {
  return (await import('./page')).default
}

const SESSION_IDS = [
  '7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
  '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ab',
  '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ac',
  '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ad',
  '7d5f46c9-3cbd-4c6d-84aa-66b8148a91ae',
] as const

function createApiFetchWithMeta(data: unknown, nextCursor: string | null = null): ApiFetchWithMeta {
  return <TSchema extends z.ZodType, TMetaSchema extends z.ZodType>(
    path: string,
    options: { readonly metaSchema: TMetaSchema; readonly schema: TSchema },
  ) => {
    if (path !== '/sessions') return Promise.reject(new DOMException(`Unexpected path: ${path}`))

    return Promise.resolve({
      data: options.schema.parse(data),
      meta: options.metaSchema.parse({ nextCursor, pageSize: 5, timeZone: DEFAULT_TIME_ZONE }),
    })
  }
}

function session(state: 'in_progress' | 'expired' | 'processing' | 'completed' | 'failed') {
  const index = ['in_progress', 'expired', 'processing', 'completed', 'failed'].indexOf(state)
  const sessionId = SESSION_IDS[index]

  if (sessionId === undefined) throw new DOMException('Session identifier was not configured.')

  return {
    bestOfDay: state === 'completed',
    categorySlug: 'focus',
    difficulty: 'balanced',
    localDate: '24/08/2026',
    localTime: '09:00',
    sessionId,
    startedAt: '2026-08-24T12:00:00.000Z',
    state,
    themeTitle: `Theme ${state}`,
    totalScore: state === 'completed' ? 73 : null,
  }
}

function renderPage(page: ReactElement) {
  return render(page)
}

describe('HistoryPage', () => {
  afterEach(cleanup)

  it('renders every session state and only links completed sessions to their analysis', async () => {
    respondToApi = createApiFetchWithMeta([
      session('in_progress'),
      session('expired'),
      session('processing'),
      session('completed'),
      session('failed'),
    ])
    const Page = await loadHistoryPage()

    renderPage(await Page({ searchParams: Promise.resolve({}) }))

    expect(screen.getByText('Em andamento')).toBeInTheDocument()
    expect(screen.getByText('Expirada')).toBeInTheDocument()
    expect(screen.getByText('Em processamento')).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText('Falhou')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Theme completed' })).toHaveAttribute(
      'href',
      `/sessions/${SESSION_IDS[3]}`,
    )
    expect(screen.queryByRole('link', { name: 'Theme expired' })).not.toBeInTheDocument()
  })

  it('marks the best session of the day', async () => {
    respondToApi = createApiFetchWithMeta([session('completed')])
    const Page = await loadHistoryPage()

    renderPage(await Page({ searchParams: Promise.resolve({}) }))

    expect(screen.getByText('Melhor do dia')).toBeInTheDocument()
  })

  it('uses the next cursor from the response metadata for pagination', async () => {
    const nextCursor = '7d5f46c9-3cbd-4c6d-84aa-66b8148a91af'
    respondToApi = createApiFetchWithMeta([session('completed')], nextCursor)
    const Page = await loadHistoryPage()

    renderPage(await Page({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('link', { name: 'Carregar mais' })).toHaveAttribute(
      'href',
      `/history?cursor=${nextCursor}`,
    )
  })

  it('describes the exercise when there are no sessions', async () => {
    respondToApi = createApiFetchWithMeta([])
    const Page = await loadHistoryPage()

    renderPage(await Page({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('heading', { name: 'Seu progresso começa aqui' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Inicie uma sessão para praticar sua apresentação e acompanhar seu progresso.',
      ),
    ).toBeInTheDocument()
  })
})
