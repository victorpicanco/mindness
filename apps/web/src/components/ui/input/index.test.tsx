import { createRef } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Input } from './index'

describe('Input', () => {
  afterEach(cleanup)

  it('forwards its ref and native input attributes', () => {
    const ref = createRef<HTMLInputElement>()

    render(<Input placeholder="Email" ref={ref} type="email" />)

    expect(ref.current).toBe(screen.getByPlaceholderText('Email'))
    expect(ref.current).toHaveAttribute('type', 'email')
    expect(ref.current).toHaveClass('rounded-full', 'border-transparent', 'bg-input', 'px-6')
  })
})
