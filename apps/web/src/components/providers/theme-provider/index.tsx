'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Theme } from '@/lib/ui/theme'

interface ThemeState {
  readonly theme: Theme
  readonly setTheme: (theme: Theme) => void
}

const THEME_STORAGE_KEY = 'mindness-theme'

class ThemeProviderError extends Error {
  readonly code = 'web.THEME_PROVIDER_MISSING'

  constructor() {
    super('useTheme must be used within ThemeProvider')
    this.name = 'ThemeProviderError'
  }
}

function createThemeStore() {
  return createStore<ThemeState>()(
    persist(
      (set) => ({
        theme: 'light',
        setTheme: (theme) => set({ theme }),
      }),
      {
        name: THEME_STORAGE_KEY,
        skipHydration: true,
        storage: createJSONStorage(() => localStorage),
      },
    ),
  )
}

const ThemeContext = createContext<StoreApi<ThemeState> | null>(null)

interface ThemeProviderProps {
  readonly children: ReactNode
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeStore] = useState(createThemeStore)

  useEffect(() => {
    const unsubscribe = themeStore.subscribe((state, previousState) => {
      if (state.theme !== previousState.theme) {
        applyTheme(state.theme)
      }
    })

    const unsubscribeHydration = themeStore.persist.onFinishHydration(() => {
      applyTheme(themeStore.getState().theme)
    })
    void themeStore.persist.rehydrate()

    return () => {
      unsubscribe()
      unsubscribeHydration()
    }
  }, [themeStore])

  return <ThemeContext.Provider value={themeStore}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const themeStore = useContext(ThemeContext)

  if (themeStore === null) {
    throw new ThemeProviderError()
  }

  return useStore(themeStore)
}
