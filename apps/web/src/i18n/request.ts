import { getRequestConfig } from 'next-intl/server'

import { messages } from './messages'

export default getRequestConfig(() => {
  return {
    locale: 'pt-BR',
    messages,
  }
})
