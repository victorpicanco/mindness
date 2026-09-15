import { messages } from './messages'
export const rootClientMessages = {
  auth: { errors: messages.auth.errors },
  common: messages.common,
}

export const publicClientMessages = {
  auth: messages.auth,
  common: messages.common,
  home: {
    practice: {
      accountEntryDialog: {
        guestNote: messages.home.practice.accountEntryDialog.guestNote,
      },
    },
  },
}

export const authenticatedClientMessages = {
  ...rootClientMessages,
  auth: {
    ...rootClientMessages.auth,
    authenticationDialog: messages.auth.authenticationDialog,
    legal: messages.auth.legal,
    password: messages.auth.password,
    signIn: messages.auth.signIn,
    signUp: messages.auth.signUp,
  },
  home: messages.home,
}
