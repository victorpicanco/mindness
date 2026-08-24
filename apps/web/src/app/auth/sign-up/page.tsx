import { SignUpForm } from './sign-up-form'
import { Surface } from '@/components/ui/surface'

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-surface px-page py-10 font-sans text-text">
      <Surface className="mx-auto grid max-w-md gap-6">
        <div className="grid gap-2">
          <h1 className="text-3xl font-semibold">Crie sua conta</h1>
          <p className="text-text-muted">Comece sua jornada de prática.</p>
        </div>
        <SignUpForm />
      </Surface>
    </main>
  )
}
