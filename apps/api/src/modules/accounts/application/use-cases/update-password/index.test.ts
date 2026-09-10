import { describe, expect, it } from 'vitest'

import { UpdatePasswordUseCase } from './index.js'

describe('UpdatePasswordUseCase', () => {
  it('updates the verified identity password without revoking sessions again', async () => {
    const calls: string[] = []
    const useCase = new UpdatePasswordUseCase({
      authIdentityProvider: {
        updatePassword: (authUserId) => {
          calls.push(`update:${authUserId}`)
          return Promise.resolve()
        },
      },
    })

    await expect(
      useCase.execute({
        authUserId: 'auth-user-1',
        authenticationMethod: 'password',
        password: 'New_password1!',
      }),
    ).resolves.toEqual({ message: 'Password updated' })
    expect(calls).toEqual(['update:auth-user-1'])
  })

  it('refuses to give a guest identity a password', async () => {
    const calls: string[] = []
    const useCase = new UpdatePasswordUseCase({
      authIdentityProvider: {
        updatePassword: (authUserId) => {
          calls.push(`update:${authUserId}`)
          return Promise.resolve()
        },
      },
    })

    await expect(
      useCase.execute({
        authUserId: 'anonymous-user-1',
        authenticationMethod: 'anonymous',
        password: 'New_password1!',
      }),
    ).rejects.toMatchObject({
      code: 'accounts.GUEST_ACCOUNT_NOT_ALLOWED',
      httpStatus: 403,
    })
    expect(calls).toEqual([])
  })
})
