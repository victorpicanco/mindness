import type { IconName } from '@/lib/ui/icon-name'

export type { IconName } from '@/lib/ui/icon-name'

interface IconProps {
  readonly className?: string | undefined
  readonly name: IconName
}

function IconDrawing({ name }: { readonly name: IconName }) {
  switch (name) {
    case 'audio-wave-01':
      return <path d="M3 12h2m2-4v8m3-12v16m4-13v10m3-7v4m2-2h2" />
    case 'cancel-01':
      return <path d="m6 6 12 12M18 6 6 18" />
    case 'chart-increase':
      return <path d="M4 18V6m0 12h16M7 14l4-4 3 3 5-6m-4 0h4v4" />
    case 'checkmark-circle-02':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </>
      )
    case 'circle':
      return <circle cx="12" cy="12" r="9" />
    case 'clock-01':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </>
      )
    case 'logout-01':
      return <path d="M10 5H6v14h4m4-11 4 4-4 4m4-4H9" />
    case 'menu-01':
      return <path d="M4 7h16M4 12h16M4 17h16" />
    case 'mic-01':
      return (
        <>
          <rect height="11" rx="3" width="6" x="9" y="3" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v4m-3 0h6" />
        </>
      )
    case 'pause':
      return (
        <>
          <rect fill="currentColor" height="12" rx="1" stroke="none" width="4" x="7" y="6" />
          <rect fill="currentColor" height="12" rx="1" stroke="none" width="4" x="13" y="6" />
        </>
      )
    case 'pencil-edit-02':
      return <path d="m14 5 5 5M4 20l4.5-1 10-10a2 2 0 0 0-5-5l-10 10L4 20Z" />
    case 'play':
      return <path d="M8.5 5.6 19 12 8.5 18.4V5.6Z" fill="currentColor" stroke="none" />
    case 'sidebar-left':
      return (
        <>
          <rect height="16" rx="2" width="18" x="3" y="4" />
          <path d="M9 4v16m5-11-3 3 3 3" />
        </>
      )
    case 'stop':
      return <rect fill="currentColor" height="12" rx="1" stroke="none" width="12" x="6" y="6" />
    case 'view':
      return (
        <>
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )
    case 'view-off':
      return (
        <>
          <path d="m4 4 16 16M10.5 6.2A10 10 0 0 1 12 6c5.5 0 9 6 9 6a16 16 0 0 1-2.2 3M6.5 6.5C4.3 8.2 3 12 3 12s3.5 6 9 6a9 9 0 0 0 3-.5" />
        </>
      )
  }
}

export function Icon({ className = 'text-xl', name }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-icon={name}
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="1em"
    >
      <IconDrawing name={name} />
    </svg>
  )
}
