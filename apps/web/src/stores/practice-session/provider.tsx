'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'

import { PracticeSessionProviderMissingError } from './errors'
import {
  createPracticeSessionStore,
  type PracticeSessionInitialState,
  type PracticeSessionState,
  type PracticeSessionStoreApi,
} from './store'

const PracticeSessionContext = createContext<PracticeSessionStoreApi | null>(null)

interface PracticeSessionProviderProps {
  readonly children: ReactNode
  readonly initialState?: PracticeSessionInitialState | undefined
}

export function PracticeSessionProvider({ children, initialState }: PracticeSessionProviderProps) {
  const storeRef = useRef<PracticeSessionStoreApi | null>(null)

  if (storeRef.current === null) {
    storeRef.current = createPracticeSessionStore(initialState)
  }

  // eslint-disable-next-line react-hooks/refs -- The store is initialized once and remains stable for this provider mount.
  const store = storeRef.current

  return <PracticeSessionContext.Provider value={store}>{children}</PracticeSessionContext.Provider>
}

export function usePracticeSessionStore<T>(selector: (state: PracticeSessionState) => T) {
  const store = useContext(PracticeSessionContext)

  if (store === null) {
    throw new PracticeSessionProviderMissingError()
  }

  return useStore(store, selector)
}
