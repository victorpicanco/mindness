import { describe, expect, it } from 'vitest'

describe('quota cycle integration', () => {
  it('waits for the integration harness of T-020', () => {
    expect.fail(
      'quota/composition/integration-container.ts does not exist yet: T-020 delivers the harness, T-021 fills in these scenarios.',
    )
  })
})
