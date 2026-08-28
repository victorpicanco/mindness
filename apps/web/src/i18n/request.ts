import { getRequestConfig } from 'next-intl/server'

import { messages } from './messages'

// Without a global default each environment formats dates in its own zone, which is what makes a
// server-rendered time disagree with the one the browser paints over it.
export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'
export const DEFAULT_LOCALE = 'pt-BR'

export default getRequestConfig(() => {
  return {
    locale: DEFAULT_LOCALE,
    messages,
    timeZone: DEFAULT_TIME_ZONE,
  }
})
