import { describe, expect, it } from 'vitest'

import {
  authenticatedClientMessages,
  publicClientMessages,
  rootClientMessages,
} from './client-messages'
import { messages } from './messages'

describe('client message catalogs', () => {
  it('keeps the full catalog off every client bundle', () => {
    expect(Object.keys(rootClientMessages).toSorted()).toEqual(['auth', 'common'])
    expect(Object.keys(rootClientMessages.auth)).toEqual(['errors'])
    expect(rootClientMessages).not.toHaveProperty('home')
  })

  it('carries the error subtree the root toast handler resolves on any route', () => {
    expect(rootClientMessages.auth.errors).toBe(messages.auth.errors)
    expect(authenticatedClientMessages.auth.errors).toBe(messages.auth.errors)
    expect(publicClientMessages.auth.errors).toBe(messages.auth.errors)
  })

  it('gives each route group only the catalog its screens render', () => {
    expect(publicClientMessages.auth).toBe(messages.auth)
    expect(publicClientMessages).not.toHaveProperty('home')

    expect(authenticatedClientMessages.home).toBe(messages.home)
    expect(authenticatedClientMessages.auth).not.toBe(messages.auth)
  })
})
