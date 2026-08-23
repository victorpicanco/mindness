import type { PillarGuidance, PillarGuidanceSet } from './types.js'

// CA-004.2 defines the score at which only one guidance is shown.
export const GUIDANCE_THRESHOLD = 80

type OrderedPillars = readonly [PillarGuidance, PillarGuidance, PillarGuidance, PillarGuidance]

export class GuidanceSelector {
  // The input is the complete set of pillars rather than a list, so "the output is never empty
  // and never repeats a pillar" (D-07) holds for every value the signature admits.
  static select(pillars: PillarGuidanceSet): readonly PillarGuidance[] {
    const ordered: OrderedPillars = [
      { pillar: 'clarity', ...pillars.clarity },
      { pillar: 'rhythm', ...pillars.rhythm },
      { pillar: 'fluency', ...pillars.fluency },
      { pillar: 'mastery', ...pillars.mastery },
    ]
    const belowThreshold = ordered.filter(({ score }) => score < GUIDANCE_THRESHOLD)

    if (belowThreshold.length > 0) return belowThreshold

    const [first, ...rest] = ordered

    return [
      rest.reduce((best, candidate) => (candidate.score < best.score ? candidate : best), first),
    ]
  }
}

export type { PillarGuidance, PillarGuidanceSet, PillarName } from './types.js'
