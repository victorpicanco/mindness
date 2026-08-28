import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SplitText } from './index'

function words(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-split-word]')].map((word) => word.textContent ?? '')
}

describe('SplitText', () => {
  afterEach(cleanup)

  it('keeps the complete accessible text while revealing it word by word', () => {
    const { container } = render(<SplitText text="Uma resposta suave" />)

    const paragraph = container.querySelector('[data-split-text="words"]')

    expect(paragraph).toHaveTextContent('Uma resposta suave')
    expect(words(container)).toEqual(['Uma', 'resposta', 'suave'])
  })

  it('preserves the original line breaks between words', () => {
    const { container } = render(<SplitText text={'Primeira linha\n\nSegunda'} />)

    expect(container.textContent).toBe('Primeira linha\n\nSegunda')
    expect(words(container)).toEqual(['Primeira', 'linha', 'Segunda'])
  })

  it('marks every word with the class that disables the reveal under reduced motion', () => {
    const { container } = render(<SplitText text="Uma resposta" />)

    for (const word of container.querySelectorAll('[data-split-word]')) {
      expect(word).toHaveClass('mindness-split-word')
    }
  })
})
