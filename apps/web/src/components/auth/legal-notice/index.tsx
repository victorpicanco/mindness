'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'

import { PrivacyPolicyContent, TermsOfUseContent } from '@/components/auth/legal-content'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/ui/class-names'

type LegalSection = 'privacy' | 'terms'

export function LegalNotice() {
  const t = useTranslations('auth.legal')
  const [activeSection, setActiveSection] = useState<LegalSection>('privacy')
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const privacyPanelId = useId()
  const termsPanelId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function openDialog() {
    setActiveSection('privacy')
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
  }

  function closeFromBackdrop(event: PointerEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeDialog()
  }

  function navigationItemClassName(isActive: boolean) {
    return cn(
      'flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-text transition-colors hover:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text md:w-full',
      isActive && 'bg-input',
    )
  }

  return (
    <>
      <p className="text-xs leading-5 text-text-muted">
        {t('noticePrefix')}{' '}
        <button
          className="cursor-pointer font-medium text-text underline underline-offset-2 hover:no-underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
          onClick={openDialog}
          type="button"
        >
          {t('title')}
        </button>
        .
      </p>

      <dialog
        aria-labelledby={titleId}
        className="m-auto h-[min(46rem,calc(100dvh-1rem))] w-[calc(100%-1rem)] max-w-4xl overflow-hidden rounded-2xl border border-divider bg-surface p-0 text-text shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-[1px] dark:backdrop:bg-black/60 md:h-[min(42rem,calc(100dvh-3rem))] md:w-[calc(100%-3rem)]"
        onCancel={(event) => {
          event.preventDefault()
          closeDialog()
        }}
        onPointerDown={closeFromBackdrop}
        ref={dialogRef}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-divider px-4 md:absolute md:top-3 md:left-3 md:z-10 md:h-10 md:border-0 md:p-0">
          <h2 className="text-lg font-medium md:sr-only" id={titleId}>
            {t('title')}
          </h2>
          <IconButton icon="cancel-01" label={t('close')} onClick={closeDialog} size="sm" />
        </header>

        <div className="flex h-[calc(100%-3.5rem)] min-h-0 flex-col md:grid md:h-full md:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="shrink-0 border-b border-divider p-2 md:min-h-0 md:border-r md:border-b-0 md:p-3">
            <nav
              aria-label={t('title')}
              className="flex gap-1 overflow-x-auto pt-1 [scrollbar-width:thin] md:mt-12 md:flex-col md:overflow-x-visible md:pt-0"
            >
              <button
                aria-controls={privacyPanelId}
                aria-current={activeSection === 'privacy' ? 'page' : undefined}
                className={navigationItemClassName(activeSection === 'privacy')}
                onClick={() => setActiveSection('privacy')}
                type="button"
              >
                <Icon className="text-lg" name="view" />
                {t('privacy.label')}
              </button>
              <button
                aria-controls={termsPanelId}
                aria-current={activeSection === 'terms' ? 'page' : undefined}
                className={navigationItemClassName(activeSection === 'terms')}
                onClick={() => setActiveSection('terms')}
                type="button"
              >
                <Icon className="text-lg" name="checkmark-circle-02" />
                {t('terms.label')}
              </button>
            </nav>
          </aside>

          {activeSection === 'privacy' ? (
            <section
              aria-label={t('privacy.label')}
              className="min-h-0 overflow-y-auto bg-surface px-5 py-6 md:px-8 md:py-8"
              id={privacyPanelId}
            >
              <header className="mb-7 grid gap-1 border-b border-divider pb-5">
                <h3 className="text-xl font-medium">{t('privacy.label')}</h3>
                <p className="text-xs text-text-muted">{t('updatedAt')}</p>
              </header>
              <div className="grid gap-7">
                <PrivacyPolicyContent />
              </div>
            </section>
          ) : null}

          {activeSection === 'terms' ? (
            <section
              aria-label={t('terms.label')}
              className="min-h-0 overflow-y-auto bg-surface px-5 py-6 md:px-8 md:py-8"
              id={termsPanelId}
            >
              <header className="mb-7 grid gap-1 border-b border-divider pb-5">
                <h3 className="text-xl font-medium">{t('terms.label')}</h3>
                <p className="text-xs text-text-muted">{t('updatedAt')}</p>
              </header>
              <div className="grid gap-7">
                <TermsOfUseContent />
              </div>
            </section>
          ) : null}
        </div>
      </dialog>
    </>
  )
}
