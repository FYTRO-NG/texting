/**
 * Private Voices — Complete Recommendation Engine Pipeline
 *
 * Coordinates:
 * 1. Pre-scoring safety gating
 * 2. Candidate generation & scoring
 * 3. Diversity re-ranking
 * 4. Output bundle emission
 */

import {
  DEFAULT_DIVERSITY_CONFIG,
  DEFAULT_SCORING_WEIGHTS,
  DiversityConfig,
  PostCandidate,
  ScoredCandidate,
  ScoringWeights,
  UserInterestProfile,
} from "./types";
import { scoreCandidate } from "./scoring";
import { applyDiversityConstraints } from "./diversity";

/**
 * Severe safety violation patterns matching Private Voices safety standards.
 */
const SEVERE_SAFETY_PATTERNS = [
  /\b(cp|child\s*porn|grooming)\b/i,
  /\b(i\s*will\s*kill\s*you|bomb\s*threat|going\s*to\s*shoot)\b/i,
  /\b(kill\s*yourself|kys|cut\s*my\s*wrists|suicide\s*method)\b/i,
  /\b(nigger|faggot|kike|chink|spic)\b/i,
  /\b(send\s*crypto|free\s*bitcoin|verify\s*account\s*at\s*http)\b/i,
];

/**
 * Evaluates whether a post passes pre-scoring safety gating.
 */
export function passesSafetyModeration(
  post: PostCandidate,
  user?: UserInterestProfile
): boolean {
  // Gate 1: Check publication lifecycle state
  if (post.status !== "published") {
    return false;
  }

  // Gate 2: User personal block list
  if (user?.blockedUserIds && user.blockedUserIds.includes(post.authorId)) {
    return false;
  }

  // Gate 3: User muted hashtags
  if (user?.mutedHashtags && post.hashtags) {
    const hasMutedTag = post.hashtags.some((t) =>
      user.mutedHashtags!.includes(t.toLowerCase())
    );
    if (hasMutedTag) return false;
  }

  // Gate 4: Severe content violation pattern matching
  if (post.text) {
    for (const pattern of SEVERE_SAFETY_PATTERNS) {
      if (pattern.test(post.text)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Full Pipeline Execution:
 * Gating -> Scoring -> Sorting -> Diversity Re-ranking.
 */
export function runRecommendationPipeline(
  candidates: PostCandidate[],
  user?: UserInterestProfile,
  scoringWeights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  diversityConfig: DiversityConfig = DEFAULT_DIVERSITY_CONFIG,
  nowMs: number = Date.now()
): ScoredCandidate[] {
  // Stage 1: Safety Gating
  const safeCandidates = candidates.filter((c) => passesSafetyModeration(c, user));

  // Stage 2: Scoring & Weighting
  const scored = safeCandidates.map((c) =>
    scoreCandidate(c, user, scoringWeights, nowMs)
  );

  // Stage 3: Raw Rank Sort
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Stage 4: Diversity Enforcement & Re-Ranking
  const diversified = applyDiversityConstraints(scored, diversityConfig);

  return diversified;
}
