import { REDIRECT_PARAM_NAME, safeRedirectPath } from '@/lib/auth/redirect-target'

import { SignInScreen } from './sign-in-screen'
import { describeSignInRedirectError } from './sign-in-error'

type SignInPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams
  const initialError = describeSignInRedirectError(params.error)
  const requestedRedirect = params[REDIRECT_PARAM_NAME]
  const redirectTo =
    typeof requestedRedirect === 'string' ? safeRedirectPath(requestedRedirect) : undefined

  return (
    <SignInScreen
      {...(initialError === undefined ? {} : { initialError })}
      {...(redirectTo === undefined ? {} : { redirectTo })}
      passwordUpdated={params.status === 'password-updated'}
    />
  )
}
