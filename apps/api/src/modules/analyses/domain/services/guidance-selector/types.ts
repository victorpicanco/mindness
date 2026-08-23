export type PillarName = 'clarity' | 'rhythm' | 'fluency' | 'mastery'

export interface PillarGuidance {
  readonly pillar: PillarName
  readonly score: number
  readonly guidance: string
}

export type PillarGuidanceSet = Record<
  PillarName,
  { readonly score: number; readonly guidance: string }
>
