'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

interface LegalSectionProps {
  readonly children: ReactNode
  readonly title: string
}

function LegalSection({ children, title }: LegalSectionProps) {
  return (
    <section className="grid gap-2">
      <h4 className="text-base font-medium text-text">{title}</h4>
      <div className="grid gap-2 text-sm leading-6 text-text-muted">{children}</div>
    </section>
  )
}

export function PrivacyPolicyContent() {
  const t = useTranslations('auth.legal.privacy')

  return (
    <>
      <p>{t('introduction')}</p>
      <LegalSection title={t('data.title')}>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('data.account')}</li>
          <li>{t('data.authentication')}</li>
          <li>{t('data.practice')}</li>
          <li>{t('data.technical')}</li>
        </ul>
      </LegalSection>
      <LegalSection title={t('use.title')}>
        <p>{t('use.description')}</p>
      </LegalSection>
      <LegalSection title={t('cloud.title')}>
        <p>{t('cloud.description')}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('cloud.supabase')}</li>
          <li>{t('cloud.cloudflare')}</li>
          <li>{t('cloud.deepgram')}</li>
          <li>{t('cloud.google')}</li>
        </ul>
        <p>{t('cloud.noAdvertising')}</p>
      </LegalSection>
      <LegalSection title={t('storage.title')}>
        <p>{t('storage.description')}</p>
      </LegalSection>
      <LegalSection title={t('localData.title')}>
        <p>{t('localData.description')}</p>
      </LegalSection>
      <LegalSection title={t('security.title')}>
        <p>{t('security.description')}</p>
      </LegalSection>
      <LegalSection title={t('rights.title')}>
        <p>{t('rights.description')}</p>
      </LegalSection>
      <LegalSection title={t('changes.title')}>
        <p>{t('changes.description')}</p>
      </LegalSection>
    </>
  )
}

export function TermsOfUseContent() {
  const t = useTranslations('auth.legal.terms')

  return (
    <>
      <p>{t('introduction')}</p>
      <LegalSection title={t('service.title')}>
        <p>{t('service.description')}</p>
      </LegalSection>
      <LegalSection title={t('account.title')}>
        <p>{t('account.description')}</p>
      </LegalSection>
      <LegalSection title={t('content.title')}>
        <p>{t('content.description')}</p>
      </LegalSection>
      <LegalSection title={t('acceptableUse.title')}>
        <p>{t('acceptableUse.description')}</p>
      </LegalSection>
      <LegalSection title={t('artificialIntelligence.title')}>
        <p>{t('artificialIntelligence.description')}</p>
      </LegalSection>
      <LegalSection title={t('availability.title')}>
        <p>{t('availability.description')}</p>
      </LegalSection>
      <LegalSection title={t('intellectualProperty.title')}>
        <p>{t('intellectualProperty.description')}</p>
      </LegalSection>
      <LegalSection title={t('termination.title')}>
        <p>{t('termination.description')}</p>
      </LegalSection>
      <LegalSection title={t('liability.title')}>
        <p>{t('liability.description')}</p>
      </LegalSection>
      <LegalSection title={t('law.title')}>
        <p>{t('law.description')}</p>
      </LegalSection>
      <LegalSection title={t('changes.title')}>
        <p>{t('changes.description')}</p>
      </LegalSection>
    </>
  )
}
