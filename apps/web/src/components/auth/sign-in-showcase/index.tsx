import Image from 'next/image'
import { useTranslations } from 'next-intl'

import { SplitText } from '@/components/ui/split-text'

type SignInShowcaseProps = {
  readonly brandName?: string | undefined
  readonly layout?: 'page' | 'dialog' | undefined
}

export function SignInShowcase({ brandName, layout = 'page' }: SignInShowcaseProps) {
  const t = useTranslations('auth.signIn.showcase')
  const isDialog = layout === 'dialog'

  return (
    <section aria-label={t('label')} className={isDialog ? 'h-full min-h-0' : 'min-h-screen p-4'}>
      <div
        className={
          isDialog
            ? 'relative h-full min-h-0 overflow-hidden bg-black'
            : 'relative h-[calc(100vh-2rem)] min-h-[calc(100vh-2rem)] overflow-hidden rounded-4xl bg-black'
        }
      >
        <Image
          alt={t('imageAlt')}
          className="object-cover object-center"
          fill
          sizes="(max-width: 1279px) 50vw, 50vw"
          src="/hero-1.webp"
        />
        {brandName === undefined ? null : (
          <span
            className="absolute top-6 left-6 z-10 font-(family-name:--font-buenard) text-2xl font-normal leading-none text-white drop-shadow-sm"
            data-testid="authentication-showcase-brand"
          >
            {brandName}
          </span>
        )}
        {isDialog ? null : (
          <>
            <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-8 xl:p-12">
              <SplitText
                className="whitespace-pre font-(family-name:--font-buenard) text-[clamp(2rem,3vw,3.5rem)] leading-[1.05] font-normal tracking-tigt text-white"
                text={`${t('messageLine1')}\n${t('messageLine2')}`}
              />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
