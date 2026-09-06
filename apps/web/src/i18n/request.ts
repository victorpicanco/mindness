import { getRequestConfig } from 'next-intl/server'

import { messages } from './messages'
export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'
export const DEFAULT_LOCALE = 'pt-BR'

export default getRequestConfig(() => {
  return {
    locale: DEFAULT_LOCALE,
    messages,
    timeZone: DEFAULT_TIME_ZONE,
  }
})
