import { SignInScreen } from './sign-in-screen'
import { signInErrorMessageKey } from './sign-in-error'

type SignInPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams
  const errorMessageKey = signInErrorMessageKey(params.error)

  return (
    <SignInScreen
      {...(errorMessageKey === undefined ? {} : { errorMessageKey })}
      passwordUpdated={params.status === 'password-updated'}
    />
  )
}
