import type { FeedbackSynthesisInput, FeedbackSynthesisResult } from './types.js'

export interface FeedbackSynthesisPort {
  synthesize(input: FeedbackSynthesisInput): Promise<FeedbackSynthesisResult>
}

export type { FeedbackSynthesisInput, FeedbackSynthesisResult } from './types.js'
