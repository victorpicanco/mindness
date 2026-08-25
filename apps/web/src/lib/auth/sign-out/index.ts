'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { createSignOutAction } from '@/lib/auth/server-actions'

export async function signOutAction(): Promise<never> {
  return createSignOutAction({ cookieStore: await cookies(), fetcher: fetch, redirect })()
}
