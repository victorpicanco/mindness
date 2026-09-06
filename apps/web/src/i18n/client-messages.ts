import { messages } from './messages'
export const rootClientMessages = {
  auth: { errors: messages.auth.errors },
  common: messages.common,
}

export const publicClientMessages = {
  auth: messages.auth,
  common: messages.common,
}

export const authenticatedClientMessages = {
  ...rootClientMessages,
  auth: { ...rootClientMessages.auth, legal: messages.auth.legal },
  home: messages.home,
}
