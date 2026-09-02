'use client'

import { useTranslations } from 'next-intl'

import type { SessionHistoryItem } from '@/lib/api/contracts/sessions'

import { SessionMessage } from '@/components/practice/session-message'
import { ThemeCountdown } from '@/components/practice/theme-countdown'

interface ExpiredSessionProps {
  readonly session: SessionHistoryItem
}

export function ExpiredSession({ session }: ExpiredSessionProps) {
  const t = useTranslations('home.conversation')

  return (
    <section aria-label={t('label')} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <SessionMessage label={t('userMessageLabel')} sender="user">
            <p>
              {t('completedConfiguration', {
                category: session.categorySlug,
                difficulty: t(`difficulties.${session.difficulty}`),
              })}
            </p>
          </SessionMessage>

          <SessionMessage label={t('assistantMessageLabel')} sender="assistant">
            <p className="text-sm text-text-muted">{t('themeIntroduction')}</p>
            <ThemeCountdown seconds={0} themeTitle={session.themeTitle ?? session.categorySlug} />
            <p className="mt-3 text-sm leading-6 text-text-muted">{t('researchInstructions')}</p>
          </SessionMessage>
        </div>
      </div>

      <div className="border-t border-divider bg-surface/95 px-4 py-4 backdrop-blur-sm sm:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-center text-sm text-text-muted">{t('expiredByInactivity')}</p>
        </div>
      </div>
    </section>
  )
}
