import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ScoreRadial } from './index'

function arc(container: HTMLElement, kind: 'track' | 'value'): SVGCircleElement {
  const element = container.querySelector<SVGCircleElement>(`[data-score-arc="${kind}"]`)

  if (element === null) throw new DOMException(`The ${kind} arc was not rendered.`)

  return element
}

function circumferenceOf(element: SVGCircleElement): number {
  return 2 * Math.PI * Number(element.getAttribute('r'))
}

describe('ScoreRadial', () => {
  afterEach(cleanup)

  it('renders the score as text over a drawing kept out of the accessibility tree', () => {
    const { container } = render(<ScoreRadial value={73} />)
    const drawing = container.querySelector('svg')

    expect(screen.getByText('73')).toBeInTheDocument()
    expect(drawing).toHaveAttribute('aria-hidden', 'true')
    expect(drawing).not.toHaveAttribute('tabindex')
  })

  it('draws the value arc as a share of a full-circle track', () => {
    const { container } = render(<ScoreRadial value={73} />)
    const value = arc(container, 'value')
    const circumference = circumferenceOf(value)

    expect(circumferenceOf(arc(container, 'track'))).toBeCloseTo(circumference, 5)
    expect(Number(value.getAttribute('stroke-dasharray'))).toBeCloseTo(circumference, 5)
    expect(Number(value.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.27, 5)
  })

  it('leaves the track empty at zero and fills it at the maximum', () => {
    const { container: empty } = render(<ScoreRadial value={0} />)
    const emptyArc = arc(empty, 'value')

    expect(Number(emptyArc.getAttribute('stroke-dashoffset'))).toBeCloseTo(
      circumferenceOf(emptyArc),
      5,
    )

    const { container: full } = render(<ScoreRadial value={100} />)

    expect(Number(arc(full, 'value').getAttribute('stroke-dashoffset'))).toBe(0)
  })

  it('clamps a score outside the range', () => {
    render(<ScoreRadial value={140} />)

    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('sizes the drawing from the requested variant', () => {
    const { container } = render(<ScoreRadial size="lg" value={50} />)

    expect(container.querySelector('svg')).toHaveAttribute('width', '168')
  })

  it('holds the arc still when the visitor asked for reduced motion', () => {
    const { container } = render(<ScoreRadial value={50} />)

    expect(arc(container, 'value')).toHaveClass('motion-reduce:transition-none')
  })
})
