interface IconProps {
  readonly className?: string | undefined
  readonly name: string
}

export function Icon({ className = 'text-xl', name }: IconProps) {
  return <span aria-hidden="true" className={`hgi-stroke hgi-${name} ${className}`} />
}
