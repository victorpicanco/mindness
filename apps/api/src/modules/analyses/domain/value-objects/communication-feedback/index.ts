import { InvalidCommunicationFeedbackError } from '@/modules/analyses/domain/errors/invalid-communication-feedback-error/index.js'

import { MOMENT_CATEGORIES } from './types.js'
import type {
  AlignmentQuality,
  AsrDivergence,
  AudioUsability,
  CreateCommunicationFeedbackParams,
  FeedbackMoment,
  ImprovementPriority,
  RecurringPattern,
  ReconstituteCommunicationFeedbackParams,
  StrengthPoint,
} from './types.js'

const MAX_LIMITATIONS = 5
const MAX_STRENGTHS = 3
const MAX_MOMENTS = 8
const MAX_PATTERNS = 5
const MAX_ASR_DIVERGENCES = 5
const MAX_PRIORITIES = 3
const MIN_SUMMARY_SENTENCES = 2
const MAX_SUMMARY_SENTENCES = 4
const MIN_PATTERN_EVIDENCES = 2
const TIMESTAMP_TOLERANCE_SECONDS = 0.25
const MOMENT_ID_PATTERN = /^M[1-9][0-9]*$/
const MARKUP_PATTERNS = [/<[a-z!/]/i, /\]\(/, /```/, /https?:\/\//i, /(^|\s)www\./i]

export class CommunicationFeedback {
  readonly durationSeconds: number
  readonly audioUsability: AudioUsability
  readonly alignmentQuality: AlignmentQuality
  readonly limitations: readonly string[]
  readonly literalTranscript: string
  readonly mainMessage: string
  readonly attemptedStructure: string
  readonly summary: string
  readonly strengths: readonly StrengthPoint[]
  readonly moments: readonly FeedbackMoment[]
  readonly patterns: readonly RecurringPattern[]
  readonly asrDivergences: readonly AsrDivergence[]
  readonly priorities: readonly ImprovementPriority[]

  private constructor(params: CreateCommunicationFeedbackParams) {
    this.durationSeconds = params.durationSeconds
    this.audioUsability = params.audioUsability
    this.alignmentQuality = params.alignmentQuality
    this.limitations = freezeList(params.limitations)
    this.literalTranscript = params.literalTranscript
    this.mainMessage = params.mainMessage
    this.attemptedStructure = params.attemptedStructure
    this.summary = params.summary
    this.strengths = freezeList(params.strengths)
    this.moments = freezeList(
      params.moments.map((moment) =>
        Object.freeze({ ...moment, categories: freezeList(moment.categories) }),
      ),
    )
    this.patterns = freezeList(
      params.patterns.map((pattern) =>
        Object.freeze({ ...pattern, evidenceMomentIds: freezeList(pattern.evidenceMomentIds) }),
      ),
    )
    this.asrDivergences = freezeList(params.asrDivergences)
    this.priorities = freezeList(
      params.priorities.map((priority) =>
        Object.freeze({ ...priority, evidenceMomentIds: freezeList(priority.evidenceMomentIds) }),
      ),
    )
  }

  static create(params: CreateCommunicationFeedbackParams): CommunicationFeedback {
    return CommunicationFeedback.fromParams(params)
  }

  static reconstitute(params: ReconstituteCommunicationFeedbackParams): CommunicationFeedback {
    return CommunicationFeedback.fromParams(params)
  }

  private static fromParams(params: CreateCommunicationFeedbackParams): CommunicationFeedback {
    validate(params)

    return new CommunicationFeedback(params)
  }
}

function validate(params: CreateCommunicationFeedbackParams): void {
  if (!Number.isFinite(params.durationSeconds) || params.durationSeconds <= 0) {
    throw new InvalidCommunicationFeedbackError('durationSeconds')
  }

  requireText(params.literalTranscript, 'literalTranscript')
  requireText(params.mainMessage, 'mainMessage')
  requireText(params.attemptedStructure, 'attemptedStructure')
  requireText(params.summary, 'summary')
  requireSummarySentences(params.summary)

  requireListSize(params.limitations, MAX_LIMITATIONS, 'limitations')
  params.limitations.forEach((limitation, index) => {
    requireText(limitation, `limitations[${index}]`)
  })
  requireUniqueItems(params.limitations, 'limitations')

  requireListSize(params.strengths, MAX_STRENGTHS, 'strengths')
  params.strengths.forEach((strength, index) => {
    requireText(strength.title, `strengths[${index}].title`)
    requireText(strength.evidence, `strengths[${index}].evidence`)
    requireText(strength.whyItHelped, `strengths[${index}].whyItHelped`)
  })
  requireUniqueItems(params.strengths.map(fingerprint), 'strengths')

  requireListSize(params.moments, MAX_MOMENTS, 'moments')
  params.moments.forEach((moment, index) => {
    validateMoment(moment, index, params.durationSeconds)
  })
  requireUniqueItems(
    params.moments.map((moment) => moment.id),
    'moments',
  )

  const momentIds = new Set(params.moments.map((moment) => moment.id))

  requireListSize(params.patterns, MAX_PATTERNS, 'patterns')
  params.patterns.forEach((pattern, index) => {
    requireText(pattern.title, `patterns[${index}].title`)
    requireText(pattern.description, `patterns[${index}].description`)
    requireText(pattern.impact, `patterns[${index}].impact`)
    requireText(pattern.exercise, `patterns[${index}].exercise`)
    requireKnownEvidence(
      pattern.evidenceMomentIds,
      momentIds,
      `patterns[${index}].evidenceMomentIds`,
    )

    if (new Set(pattern.evidenceMomentIds).size < MIN_PATTERN_EVIDENCES) {
      throw new InvalidCommunicationFeedbackError(`patterns[${index}].evidenceMomentIds`)
    }
  })
  requireUniqueItems(params.patterns.map(fingerprint), 'patterns')

  requireListSize(params.asrDivergences, MAX_ASR_DIVERGENCES, 'asrDivergences')
  params.asrDivergences.forEach((divergence, index) => {
    requireInterval(
      divergence.startSeconds,
      divergence.endSeconds,
      params.durationSeconds,
      `asrDivergences[${index}]`,
    )
    requireText(divergence.asrVersion, `asrDivergences[${index}].asrVersion`)
    requireText(divergence.heardVersion, `asrDivergences[${index}].heardVersion`)
    requireText(divergence.relevance, `asrDivergences[${index}].relevance`)
  })
  requireUniqueItems(params.asrDivergences.map(fingerprint), 'asrDivergences')

  requireListSize(params.priorities, MAX_PRIORITIES, 'priorities')
  params.priorities.forEach((priority, index) => {
    requireText(priority.title, `priorities[${index}].title`)
    requireText(priority.behavior, `priorities[${index}].behavior`)
    requireText(priority.importance, `priorities[${index}].importance`)
    requireText(priority.action, `priorities[${index}].action`)
    requireText(priority.exercise, `priorities[${index}].exercise`)
    requireKnownEvidence(
      priority.evidenceMomentIds,
      momentIds,
      `priorities[${index}].evidenceMomentIds`,
    )
  })
  requireUniqueItems(params.priorities.map(fingerprint), 'priorities')
}

function validateMoment(moment: FeedbackMoment, index: number, durationSeconds: number): void {
  if (!MOMENT_ID_PATTERN.test(moment.id)) {
    throw new InvalidCommunicationFeedbackError(`moments[${index}].id`)
  }

  requireInterval(moment.startSeconds, moment.endSeconds, durationSeconds, `moments[${index}]`)
  requireText(moment.excerpt, `moments[${index}].excerpt`)
  requireExplanation(moment.observation, `moments[${index}].observation`)
  requireExplanation(moment.impact, `moments[${index}].impact`)
  requireExplanation(moment.nextAttempt, `moments[${index}].nextAttempt`)

  if (moment.clearerAlternative !== null) {
    requireText(moment.clearerAlternative, `moments[${index}].clearerAlternative`)
  }

  if (moment.categories.length === 0) {
    throw new InvalidCommunicationFeedbackError(`moments[${index}].categories`)
  }

  requireUniqueItems(moment.categories, `moments[${index}].categories`)
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new InvalidCommunicationFeedbackError(field)
  }

  if (MARKUP_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new InvalidCommunicationFeedbackError(field)
  }
}

function requireExplanation(value: string, field: string): void {
  requireText(value, field)

  const normalized = value.trim().toLowerCase()

  if (MOMENT_CATEGORIES.some((category) => category === normalized)) {
    throw new InvalidCommunicationFeedbackError(field)
  }
}

function requireSummarySentences(summary: string): void {
  const sentences = summary
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)

  if (sentences.length < MIN_SUMMARY_SENTENCES || sentences.length > MAX_SUMMARY_SENTENCES) {
    throw new InvalidCommunicationFeedbackError('summary')
  }
}

function requireListSize(list: readonly unknown[], max: number, field: string): void {
  if (list.length > max) {
    throw new InvalidCommunicationFeedbackError(field)
  }
}

function requireUniqueItems(items: readonly string[], field: string): void {
  if (new Set(items).size !== items.length) {
    throw new InvalidCommunicationFeedbackError(field)
  }
}

function requireKnownEvidence(
  evidenceMomentIds: readonly string[],
  momentIds: ReadonlySet<string>,
  field: string,
): void {
  requireUniqueItems(evidenceMomentIds, field)

  if (evidenceMomentIds.some((momentId) => !momentIds.has(momentId))) {
    throw new InvalidCommunicationFeedbackError(field)
  }
}

function requireInterval(
  startSeconds: number,
  endSeconds: number,
  durationSeconds: number,
  field: string,
): void {
  const withinAudio =
    Number.isFinite(startSeconds) &&
    Number.isFinite(endSeconds) &&
    startSeconds >= 0 &&
    startSeconds <= endSeconds &&
    endSeconds <= durationSeconds + TIMESTAMP_TOLERANCE_SECONDS

  if (!withinAudio) {
    throw new InvalidCommunicationFeedbackError(field)
  }
}

function fingerprint(item: object): string {
  return JSON.stringify(item, Object.keys(item).sort())
}

function freezeList<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items])
}

export {
  ALIGNMENT_QUALITIES,
  AUDIO_USABILITIES,
  FEEDBACK_CONFIDENCES,
  MOMENT_CATEGORIES,
  MOMENT_VALENCES,
  TIMING_BASES,
} from './types.js'
export type {
  AlignmentQuality,
  AsrDivergence,
  AudioUsability,
  CreateCommunicationFeedbackParams,
  FeedbackConfidence,
  FeedbackMoment,
  ImprovementPriority,
  MomentCategory,
  MomentValence,
  RecurringPattern,
  ReconstituteCommunicationFeedbackParams,
  StrengthPoint,
  TimingBasis,
} from './types.js'
