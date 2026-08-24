'use client'

import { type FormEvent, useState } from 'react'

import { initialSignUpActionState, type SignUpActionState, signUpAction } from './actions'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export type SignUpFormAction = (
  state: SignUpActionState,
  formData: FormData,
) => Promise<SignUpActionState>

type SignUpFormProps = {
  readonly action?: SignUpFormAction
}

type ValidationErrors = {
  readonly email?: string
  readonly password?: string
}

const PASSWORD_MESSAGE =
  'Use uma senha de 12 a 64 caracteres com letras maiúsculas e minúsculas, número e símbolo.'

function validate(formData: FormData): ValidationErrors {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return { email: 'Informe um e-mail válido.' }
  }

  if (typeof password !== 'string' || password.length < 12 || password.length > 64) {
    return { password: PASSWORD_MESSAGE }
  }

  return {}
}

export function SignUpForm({ action = signUpAction }: SignUpFormProps) {
  const [state, setState] = useState<SignUpActionState>(initialSignUpActionState)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const validationErrors = validate(formData)

    setErrors(validationErrors)

    if (validationErrors.email !== undefined || validationErrors.password !== undefined) {
      return
    }

    setIsSubmitting(true)
    setState(await action(state, formData))
    setIsSubmitting(false)
  }

  if (state.status === 'success') {
    return <p role="status">{state.message}</p>
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      <input name="captchaToken" type="hidden" value="" />
      <div className="grid gap-4">
        <Field {...(errors.email === undefined ? {} : { error: errors.email })} label="E-mail">
          <Input autoComplete="email" name="email" type="email" />
        </Field>
        <Field {...(errors.password === undefined ? {} : { error: errors.password })} label="Senha">
          <Input autoComplete="new-password" name="password" type="password" />
        </Field>
        {state.status === 'error' ? <p role="alert">{state.message}</p> : null}
        <Button isLoading={isSubmitting} type="submit">
          Criar conta
        </Button>
      </div>
    </form>
  )
}
