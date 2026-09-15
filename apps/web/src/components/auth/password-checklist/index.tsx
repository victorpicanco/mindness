'use client'

import { useTranslations } from 'next-intl'

import { Icon } from '@/components/ui/icon'

import { passwordRequirements } from '@/lib/auth/password-policy'

type PasswordChecklistProps = {
  readonly password: string
}

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const t = useTranslations('auth.password.requirements')

  return (
    <ul aria-label={t('title')} className="flex flex-wrap gap-2">
      {passwordRequirements.map((requirement) => {
        const isSatisfied = requirement.isSatisfied(password)

        return (
          <li
            className={
              isSatisfied
                ? 'inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] leading-none text-text'
                : 'inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-[11px] leading-none text-text-muted'
            }
            data-satisfied={isSatisfied}
            key={requirement.key}
          >
            <Icon
              className={
                isSatisfied ? 'shrink-0 text-xs text-success' : 'shrink-0 text-xs text-text-muted'
              }
              name={isSatisfied ? 'checkmark-circle-02' : 'circle'}
            />
            {t(requirement.key)}
          </li>
        )
      })}
    </ul>
  )
}
