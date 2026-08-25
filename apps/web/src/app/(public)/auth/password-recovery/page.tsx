import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { EmailRequestForm } from '@/components/auth/email-request-form'
import { AuthPageShell } from '@/components/auth/page-shell'
import { requestPasswordRecoveryAction } from './actions'

export default function PasswordRecoveryPage() {
  const t = useTranslations('auth.recovery')
  return (
    <AuthPageShell description={t('description')} title={t('title')}>
      <EmailRequestForm
        action={requestPasswordRecoveryAction}
        submitLabel={t('submit')}
        successMessage={t('success')}
      />
      <Link className="text-center text-sm underline" href="/auth/sign-in">
        {t('back')}
      </Link>
    </AuthPageShell>
  )
}
