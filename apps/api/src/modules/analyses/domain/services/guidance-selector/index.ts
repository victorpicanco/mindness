import type { PillarGuidance, PillarGuidanceSet } from './types.js'

export const GUIDANCE_THRESHOLD = 80

type OrderedPillars = readonly [PillarGuidance, PillarGuidance, PillarGuidance, PillarGuidance]

export class GuidanceSelector {
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
