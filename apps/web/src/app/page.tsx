import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Surface } from '@/components/ui/surface'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface px-page py-10 font-sans text-text">
      <div className="mx-auto grid max-w-5xl gap-8">
        <header className="grid gap-2">
          <p className="text-sm font-medium text-text-muted">Temporary component showcase</p>
          <h1 className="text-3xl font-semibold tracking-tight">Mindness</h1>
          <p className="max-w-2xl text-text-muted">
            A compact view of the current interface primitives across light and dark system themes.
          </p>
        </header>

        <section aria-labelledby="buttons-heading" className="grid gap-4">
          <h2 className="text-lg font-semibold" id="buttons-heading">
            Buttons
          </h2>
          <Surface className="grid gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button>Primary</Button>
              <Button size="lg">Large</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button isLoading>Loading</Button>
            </div>
          </Surface>
        </section>

        <section aria-labelledby="fields-heading" className="grid gap-4">
          <h2 className="text-lg font-semibold" id="fields-heading">
            Fields and select
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Surface className="grid gap-4">
              <Field description="Use the address tied to your account" label="Email">
                <Input placeholder="you@example.com" type="email" />
              </Field>
              <Field error="Enter a valid email address" label="Email with error">
                <Input defaultValue="not-an-email" type="email" />
              </Field>
            </Surface>
            <Surface className="grid content-start gap-4">
              <Field description="Choose a focus for your next practice" label="Category">
                <Select defaultValue="focus">
                  <option value="focus">Focus</option>
                  <option value="confidence">Confidence</option>
                  <option value="clarity">Clarity</option>
                </Select>
              </Field>
            </Surface>
          </div>
        </section>

        <section aria-labelledby="feedback-heading" className="grid gap-4">
          <h2 className="text-lg font-semibold" id="feedback-heading">
            Surface and feedback
          </h2>
          <Surface className="flex items-center gap-3">
            <Spinner />
            <div>
              <p className="font-medium">Preparing your practice</p>
              <p className="text-sm text-text-muted">
                The spinner includes a visually hidden status label.
              </p>
            </div>
          </Surface>
        </section>
      </div>
    </main>
  )
}
