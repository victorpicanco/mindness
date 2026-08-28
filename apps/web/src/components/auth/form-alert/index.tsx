export function AuthFormAlert({ message }: { readonly message: string | undefined }) {
  if (message === undefined) return null

  return (
    <p className="text-sm text-error" role="alert">
      {message}
    </p>
  )
}
