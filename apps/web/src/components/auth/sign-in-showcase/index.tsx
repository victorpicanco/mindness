import Image from 'next/image'
import { useTranslations } from 'next-intl'

import { SplitText } from '@/components/ui/split-text'

export function SignInShowcase() {
  const t = useTranslations('auth.signIn.showcase')

  return (
    <section aria-label={t('label')} className="min-h-screen p-4">
      <div className="relative h-[calc(100vh-2rem)] min-h-[calc(100vh-2rem)] overflow-hidden rounded-4xl bg-black">
        <Image
          alt={t('imageAlt')}
          className="object-cover object-center"
          fill
          quality={90}
          sizes="(max-width: 1279px) 50vw, 50vw"
          src="/hero-1.webp"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 xl:p-12">
          <SplitText
            className="whitespace-pre font-(family-name:--font-buenard) text-[clamp(2rem,3vw,3.5rem)] leading-[1.05] font-normal tracking-tigt text-white"
            text={`${t('messageLine1')}\n${t('messageLine2')}`}
          />
        </div>
      </div>
    </section>
  )
}
