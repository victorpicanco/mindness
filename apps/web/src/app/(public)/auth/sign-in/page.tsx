import { SignInScreen } from '@/components/auth/sign-in-screen'
import { REDIRECT_PARAM_NAME, safeRedirectPath } from '@/lib/auth/redirect-target'

import { signInAction } from './actions'
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
      action={signInAction}
      initialError={initialError}
      redirectTo={redirectTo}
      passwordUpdated={params.status === 'password-updated'}
    />
  )
}
