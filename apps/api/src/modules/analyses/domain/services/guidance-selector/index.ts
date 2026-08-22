import type { PillarGuidance, PillarName } from './types.js'

// CA-004.2 defines the score at which only one guidance is shown.
export const GUIDANCE_THRESHOLD = 80

const PILLAR_ORDER: readonly PillarName[] = ['clarity', 'rhythm', 'fluency', 'mastery']

export class GuidanceSelector {
  static select(pillars: readonly PillarGuidance[]): readonly PillarGuidance[] {
    const orderedPillars = PILLAR_ORDER.flatMap((pillarName) =>
      pillars.filter(({ pillar }) => pillar === pillarName),
    )
    const belowThreshold = orderedPillars.filter(({ score }) => score < GUIDANCE_THRESHOLD)

    if (belowThreshold.length > 0) return belowThreshold

    const lowestScore = Math.min(...orderedPillars.map(({ score }) => score))
    return orderedPillars.filter(({ score }) => score === lowestScore).slice(0, 1)
  }
}
