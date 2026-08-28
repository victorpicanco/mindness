interface ShinyTextProps {
  readonly className?: string
  readonly text: string
}

export function ShinyText({ className, text }: ShinyTextProps) {
  return (
    <span
      className={
        className === undefined ? 'mindness-shiny-text' : `mindness-shiny-text ${className}`
      }
    >
      {text}
    </span>
  )
}
