import Image from 'next/image'
import Link from 'next/link'

interface BrandLinkProps {
  readonly className?: string | undefined
  readonly isExpanded?: boolean | undefined
  readonly label: string
  readonly logoAlt: string
  readonly onClick?: (() => void) | undefined
}

const ICON_LINK_CLASSES =
  'grid size-10 shrink-0 place-items-center rounded-[0.875rem] transition-colors hover:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

const WORDMARK_LINK_CLASSES =
  'inline-flex h-10 shrink-0 items-center rounded-[0.875rem] px-1 transition-colors hover:bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text'

export function BrandLink({ className, isExpanded, label, logoAlt, onClick }: BrandLinkProps) {
  const baseClasses = isExpanded === true ? WORDMARK_LINK_CLASSES : ICON_LINK_CLASSES

  return (
    <Link
      {...(onClick === undefined ? {} : { onClick })}
      aria-label={label}
      className={className === undefined ? baseClasses : `${baseClasses} ${className}`}
      href="/"
    >
      {isExpanded === true ? (
        <span className="font-(family-name:--font-buenard) text-2xl">{logoAlt}</span>
      ) : (
        <Image alt={logoAlt} height={28} priority src="/logo-icon.svg" width={28} />
      )}
    </Link>
  )
}
