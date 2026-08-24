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
        password: 'New_password1!',
      }),
    ).resolves.toEqual({ message: 'Password updated' })
    expect(calls).toEqual(['update:auth-user-1'])
  })
})
