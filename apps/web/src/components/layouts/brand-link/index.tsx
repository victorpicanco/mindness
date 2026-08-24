import Image from 'next/image'
import Link from 'next/link'

interface BrandLinkProps {
  readonly className?: string | undefined
  readonly label: string
  readonly logoAlt: string
  readonly onClick?: (() => void) | undefined
}

const BRAND_LINK_CLASSES =
  'grid size-10 shrink-0 place-items-center rounded-[0.875rem] transition-colors hover:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

export function BrandLink({ className, label, logoAlt, onClick }: BrandLinkProps) {
  return (
    <Link
      {...(onClick === undefined ? {} : { onClick })}
      aria-label={label}
      className={
        className === undefined ? BRAND_LINK_CLASSES : `${BRAND_LINK_CLASSES} ${className}`
      }
      href="/"
    >
      <Image alt={logoAlt} height={28} priority src="/logo-icon.svg" width={28} />
    </Link>
  )
}
