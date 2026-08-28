// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SplitText } from './index'

describe('SplitText server rendering', () => {
  it('emits the same reveal styles the client applies on hydration', () => {
    const markup = renderToStaticMarkup(<SplitText text="Uma resposta" />)

    expect(markup).toContain('blur(4px)')
    expect(markup).toContain('translateY(10px)')
  })
})
