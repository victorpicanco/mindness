import { useTranslations } from 'next-intl'

import { ToastTrigger } from '@/components/showcase/toast-trigger'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Surface } from '@/components/ui/surface'

export default function ShowcasePage() {
  const t = useTranslations('home')

  return (
    <main className="min-h-screen bg-surface px-page py-10 font-sans text-text">
      <div className="mx-auto grid max-w-5xl gap-8">
        <header className="grid gap-2">
          <p className="text-sm font-medium text-text-muted">{t('showcase')}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="max-w-2xl text-text-muted">{t('description')}</p>
        </header>

        <section aria-labelledby="buttons-heading" className="grid gap-4">
          <h2 className="text-lg font-semibold" id="buttons-heading">
            {t('buttonsHeading')}
          </h2>
          <Surface className="grid gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">{t('buttons.small')}</Button>
              <Button>{t('buttons.primary')}</Button>
              <Button size="lg">{t('buttons.large')}</Button>
              <Button variant="secondary">{t('buttons.secondary')}</Button>
              <Button variant="destructive">{t('buttons.destructive')}</Button>
              <Button isLoading>{t('buttons.loading')}</Button>
            </div>
          </Surface>
        </section>

        <section aria-labelledby="fields-heading" className="grid gap-4">
          <h2 className="text-lg font-semibold" id="fields-heading">
            {t('fieldsHeading')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Surface className="grid gap-4">
              <Field description={t('fields.emailDescription')} label={t('fields.emailLabel')}>
                <Input placeholder={t('fields.emailPlaceholder')} type="email" />
              </Field>
              <Field error={t('fields.emailError')} label={t('fields.emailErrorLabel')}>
                <Input defaultValue="not-an-email" type="email" />
              </Field>
            </Surface>
            <Surface className="grid content-start gap-4">
              <Field
                description={t('fields.categoryDescription')}
                label={t('fields.categoryLabel')}
              >
                <Select defaultValue="focus">
                  <option value="focus">{t('fields.focus')}</option>
                  <option value="confidence">{t('fields.confidence')}</option>
                  <option value="clarity">{t('fields.clarity')}</option>
                </Select>
              </Field>
            </Surface>
          </div>
        </section>

        <section aria-labelledby="feedback-heading" className="grid gap-4">
          <h2 className="text-lg font-semibold" id="feedback-heading">
            {t('feedbackHeading')}
          </h2>
          <Surface className="flex items-center gap-3">
            <Spinner />
            <div>
              <p className="font-medium">{t('feedback.title')}</p>
              <p className="text-sm text-text-muted">{t('feedback.description')}</p>
            </div>
          </Surface>
          <Surface>
            <ToastTrigger />
          </Surface>
        </section>
      </div>
    </main>
  )
}
