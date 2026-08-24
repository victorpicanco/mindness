import { describe, expect, it } from 'vitest'

import { UpdatePasswordUseCase } from './index.js'

describe('UpdatePasswordUseCase', () => {
  it('updates the verified identity password and revokes its sessions', async () => {
    const calls: string[] = []
    const useCase = new UpdatePasswordUseCase({
      authIdentityProvider: {
        updatePassword: (authUserId) => {
          calls.push(`update:${authUserId}`)
          return Promise.resolve()
        },
        revokeSession: (accessToken) => {
          calls.push(`revoke:${accessToken}`)
          return Promise.resolve()
        },
      },
    })

    await expect(
      useCase.execute({
        accessToken: 'access-token',
        authUserId: 'auth-user-1',
        password: 'New_password1!',
      }),
    ).resolves.toEqual({ message: 'Password updated' })
    expect(calls).toEqual(['update:auth-user-1', 'revoke:access-token'])
  })
})
