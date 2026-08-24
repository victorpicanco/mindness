import Image from 'next/image'
import { useTranslations } from 'next-intl'

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
      </div>
    </section>
  )
}
