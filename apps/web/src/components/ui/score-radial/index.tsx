import { cn } from '@/lib/ui/class-names'

const VARIANTS = {
  lg: { barSize: 11, diameter: 168, valueClassName: 'text-4xl' },
  sm: { barSize: 7, diameter: 104, valueClassName: 'text-xl' },
} as const

const SCORE_MIN = 0
const SCORE_MAX = 100

type ScoreRadialSize = keyof typeof VARIANTS

interface ScoreRadialProps {
  readonly size?: ScoreRadialSize
  readonly value: number
}

export function ScoreRadial({ size = 'sm', value }: ScoreRadialProps) {
  const { barSize, diameter, valueClassName } = VARIANTS[size]
  const score = Math.round(Math.min(SCORE_MAX, Math.max(SCORE_MIN, value)))
  const center = diameter / 2
  const radius = center - barSize / 2
  const circumference = 2 * Math.PI * radius

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <svg
        aria-hidden="true"
        fill="none"
        height={diameter}
        viewBox={`0 0 ${String(diameter)} ${String(diameter)}`}
        width={diameter}
      >
        <circle
          cx={center}
          cy={center}
          data-score-arc="track"
          r={radius}
          stroke="var(--color-divider)"
          strokeWidth={barSize}
        />
        {/* Sweeping clockwise from the top reads the score as a share of the whole ring. */}
        <circle
          className="transition-[stroke-dashoffset] duration-900 ease-out motion-reduce:transition-none"
          cx={center}
          cy={center}
          data-score-arc="value"
          r={radius}
          stroke="var(--color-accent)"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / SCORE_MAX)}
          strokeLinecap="round"
          strokeWidth={barSize}
          transform={`rotate(-90 ${String(center)} ${String(center)})`}
        />
      </svg>
      <span className={cn('absolute font-medium tabular-nums tracking-tight', valueClassName)}>
        {score}
      </span>
    </span>
  )
}
