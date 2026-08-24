import { useTranslations } from 'next-intl'

import { signOutAction } from '@/app/auth/sign-out/actions'
import { Button } from '@/components/ui/button'

export default function PracticePage() {
  const t = useTranslations('auth.signOut')
  const commonT = useTranslations('common.metadata')
  return (
    <main className="min-h-screen bg-surface px-6 py-10 text-text">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6">
        <h1 className="text-2xl font-semibold">{commonT('title')}</h1>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            {t('submit')}
          </Button>
        </form>
      </div>
    </main>
  )
}
