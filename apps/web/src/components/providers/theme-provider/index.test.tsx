import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ThemeProvider, useTheme } from './index'

function ThemeControls() {
  const { setTheme, theme } = useTheme()

  return (
    <>
      <output>{theme}</output>
      <button onClick={() => setTheme('dark')} type="button">
        Use dark theme
      </button>
      <button onClick={() => setTheme('light')} type="button">
        Use light theme
      </button>
    </>
  )
}

describe('ThemeProvider', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.classList.remove('dark')
    localStorage.clear()
  })

  it('applies and persists the selected dark theme', () => {
    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }))

    expect(screen.getByText('dark')).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('mindness-theme')).toContain('dark')
  })

  it('restores the persisted theme after hydration', () => {
    localStorage.setItem('mindness-theme', JSON.stringify({ state: { theme: 'dark' }, version: 0 }))

    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>,
    )

    expect(screen.getByText('dark')).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')
  })

  it('removes the dark class when the light theme is selected', () => {
    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use light theme' }))

    expect(screen.getByText('light')).toBeInTheDocument()
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
