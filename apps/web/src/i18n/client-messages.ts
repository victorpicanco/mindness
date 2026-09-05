import { messages } from './messages'

// The toast handler mounted at the root translates API error codes, and `web.AUTHENTICATION_EXPIRED`
// resolves to `auth.errors.sessionExpired` on an authenticated route. That subtree therefore travels
// everywhere, while the rest of each catalog stays on the routes that render it.
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
