import '@testing-library/jest-dom/vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }

  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
}
