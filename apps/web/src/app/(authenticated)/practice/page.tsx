import { getTranslations } from 'next-intl/server'

import { signOutAction } from '@/app/auth/sign-out/actions'
import { Button } from '@/components/ui/button'

export default async function PracticePage() {
  const t = await getTranslations('auth.signOut')
  const commonT = await getTranslations('common.metadata')

  return (
    <div className="min-h-dvh bg-surface px-6 py-10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6">
        <h1 className="text-2xl font-semibold">{commonT('title')}</h1>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            {t('submit')}
          </Button>
        </form>
      </div>
    </div>
  )
}
