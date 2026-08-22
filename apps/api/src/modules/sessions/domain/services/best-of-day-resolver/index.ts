import { LocalCalendar } from '@/modules/sessions/domain/services/local-calendar/index.js'

import type { BestOfDayCandidate } from './types.js'

export class BestOfDayResolver {
  static resolve(candidates: readonly BestOfDayCandidate[], timeZone: string): ReadonlySet<string> {
    const winnersByDay = new Map<string, BestOfDayCandidate>()

    for (const candidate of candidates) {
      const localDay = LocalCalendar.localDayOf(candidate.createdAt, timeZone)
      const currentWinner = winnersByDay.get(localDay)

      if (currentWinner === undefined || winsAgainst(candidate, currentWinner)) {
        winnersByDay.set(localDay, candidate)
      }
    }

    return new Set([...winnersByDay.values()].map((winner) => winner.sessionId))
  }
}

function winsAgainst(candidate: BestOfDayCandidate, currentWinner: BestOfDayCandidate): boolean {
  if (candidate.totalScore !== currentWinner.totalScore) {
    return candidate.totalScore > currentWinner.totalScore
  }

  if (candidate.createdAt.getTime() !== currentWinner.createdAt.getTime()) {
    return candidate.createdAt.getTime() < currentWinner.createdAt.getTime()
  }

  return candidate.sessionId < currentWinner.sessionId
}

export type { BestOfDayCandidate } from './types.js'
