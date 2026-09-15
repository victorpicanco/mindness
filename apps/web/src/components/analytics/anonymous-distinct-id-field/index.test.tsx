import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AnonymousDistinctIdField } from './index'

describe('AnonymousDistinctIdField', () => {
  afterEach(cleanup)

  it('propagates the anonymous browser identity without exposing the provider user id', async () => {
    render(<AnonymousDistinctIdField getDistinctId={() => 'browser-anonymous-id'} />)

    await waitFor(() => {
      expect(screen.getByTestId('anonymous-distinct-id')).toHaveValue('browser-anonymous-id')
    })
    expect(screen.getByTestId('anonymous-distinct-id')).toHaveAttribute(
      'name',
      'anonymousDistinctId',
    )
  })
})
