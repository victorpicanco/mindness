import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Icon, type IconName } from './index'

const ICON_NAMES = [
  'audio-wave-01',
  'cancel-01',
  'chart-increase',
  'checkmark-circle-02',
  'circle',
  'clock-01',
  'delete-02',
  'logout-01',
  'menu-01',
  'mic-01',
  'more-vertical',
  'pencil-edit-02',
  'sidebar-left',
  'stop',
  'user-circle',
  'view',
  'view-off',
] as const satisfies readonly IconName[]

describe('Icon', () => {
  afterEach(cleanup)

  it.each(ICON_NAMES)('renders the typed %s icon as inline SVG', (name) => {
    const { container } = render(<Icon name={name} />)

    expect(container.firstElementChild?.tagName).toBe('svg')
    expect(container.firstElementChild).toHaveAttribute('data-icon', name)
    expect(container.querySelector('path, line, polyline, rect, circle')).not.toBeNull()
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('replaces the default size with the given class name', () => {
    const { container } = render(<Icon className="text-3xl" name="cancel-01" />)

    expect(container.firstElementChild).toHaveClass('text-3xl')
    expect(container.firstElementChild).not.toHaveClass('text-xl')
  })
})
