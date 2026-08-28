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
    <ul aria-label={t('title')} className="grid gap-1.5 text-sm">
      {passwordRequirements.map((requirement) => {
        const isSatisfied = requirement.isSatisfied(password)

        return (
          <li
            className={
              isSatisfied
                ? 'flex items-center gap-2 text-text'
                : 'flex items-center gap-2 text-text-muted'
            }
            data-satisfied={isSatisfied}
            key={requirement.key}
          >
            <Icon
              className={isSatisfied ? 'text-success' : 'text-text-muted'}
              name={isSatisfied ? 'checkmark-circle-02' : 'circle'}
            />
            {t(requirement.key)}
          </li>
        )
      })}
    </ul>
  )
}
