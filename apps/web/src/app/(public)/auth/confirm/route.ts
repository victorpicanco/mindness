import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiFetch } from '@/lib/api/server-client'
import { provisionAccount } from '@/lib/auth/provision-account'
import { SIGNED_IN_HOME } from '@/lib/auth/redirect-target'
import { writeSessionCookies } from '@/lib/auth/session'

const sessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.iso.datetime(),
})

type CookieStore = Parameters<typeof writeSessionCookies>[0]

type Dependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

function redirect(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), { status: 302 })
}

export function createEmailConfirmationRouteHandler({ cookieStore, fetcher }: Dependencies) {
  return async function emailConfirmationRouteHandler(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const tokenHash = url.searchParams.get('token_hash')
    const type = url.searchParams.get('type')
    if (tokenHash === null || (type !== 'email' && type !== 'recovery')) {
      return redirect(request, '/auth/confirmed?status=invalid')
    }

    try {
      const session = await apiFetch('/auth/email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenHash, type }),
        cookieStore,
        fetcher,
        schema: sessionSchema,
      })
      writeSessionCookies(cookieStore, session)
      if (type === 'recovery') return redirect(request, '/auth/update-password')

      const provisionError = await provisionAccount({ cookieStore, fetcher })
      if (provisionError !== null) {
        return redirect(request, `/auth/sign-in?error=${encodeURIComponent(provisionError.code)}`)
      }

      return redirect(request, SIGNED_IN_HOME)
    } catch {
      return redirect(
        request,
        type === 'recovery'
          ? '/auth/update-password?status=invalid'
          : '/auth/confirmed?status=invalid',
      )
    }
  }
}

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies()
  return createEmailConfirmationRouteHandler({ cookieStore, fetcher: fetch })(request)
}
