/**
 * Private Voices — Mathematical Scoring & Recommendation Formulations
 */

import {
  DEFAULT_SCORING_WEIGHTS,
  PostCandidate,
  ScoredCandidate,
  ScoringWeights,
  UserInterestProfile,
} from "./types";

/**
 * Calculates raw heuristic engagement score:
 * S_heur = (w_l * likes) + (w_r * replies) + (w_s * reposts) + (w_neg * negativeSignals)
 */
export function calculateHeuristicScore(
  post: PostCandidate,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  const likes = Math.max(0, post.likes || 0);
  const replies = Math.max(0, post.commentsCount || 0);
  const reposts = Math.max(0, post.reposts || 0);
  const neg = Math.max(0, post.negativeSignals || 0);

  const engagement =
    likes * weights.likeWeight +
    replies * weights.replyWeight +
    reposts * weights.repostWeight +
    neg * weights.negativePenalty;

  // Base constant ensures newly posted high-potential content isn't 0
  return Math.max(0, engagement + 1.0);
}

/**
 * Calculates time decay gravity factor:
 * Decay(T) = 1 / ((T + 2) ^ G)
 * where T is the age in hours, and G is the gravity exponent.
 */
export function calculateTimeDecay(
  postCreatedAtMs: number,
  nowMs: number = Date.now(),
  gravity: number = DEFAULT_SCORING_WEIGHTS.timeDecayGravity
): number {
  const ageHours = Math.max(0, (nowMs - postCreatedAtMs) / (1000 * 60 * 60));
  const denominator = Math.pow(ageHours + 2.0, gravity);
  return 1.0 / denominator;
}

/**
 * Calculates engagement velocity for fast-spiking candidates:
 * Velocity = (ΔLikes + 2 * ΔReplies) / (ΔT_hours + 1.0)
 */
export function calculateEngagementVelocity(
  post: PostCandidate,
  nowMs: number = Date.now()
): number {
  const ageHours = Math.max(0.05, (nowMs - post.createdAt) / (1000 * 60 * 60));
  const engagementSum = (post.likes || 0) + 2.0 * (post.commentsCount || 0) + 2.5 * (post.reposts || 0);
  return engagementSum / (ageHours + 1.0);
}

/**
 * Computes Cosine Similarity between user profile vector U and candidate vector P:
 * Affinity(U, P) = (U . P) / (||U|| * ||P||)
 * Returns a value normalized between [0, 1].
 */
export function computeCosineSimilarity(
  vecA?: number[],
  vecB?: number[]
): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0.5; // neutral fallback
  }

  const length = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0.5;
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Rescale similarity from [-1, 1] to [0, 1] for unified additive scoring
  return Math.max(0, Math.min(1, (similarity + 1.0) / 2.0));
}

/**
 * Calculates semantic ML affinity score:
 * Combines vector cosine similarity with user hashtag affinity overlap.
 */
export function calculateSemanticAffinity(
  post: PostCandidate,
  user?: UserInterestProfile
): number {
  if (!user) {
    return 0.5; // Cold-start neutral default
  }

  // 1. Vector similarity (if embeddings present)
  const vectorScore = computeCosineSimilarity(
    user.interestEmbedding,
    post.embedding
  );

  // 2. Hashtag affinity overlap
  let tagOverlapScore = 0.5;
  if (user.engagedHashtags && post.hashtags && post.hashtags.length > 0) {
    let matchPoints = 0;
    for (const tag of post.hashtags) {
      if (user.engagedHashtags[tag]) {
        matchPoints += Math.min(3, user.engagedHashtags[tag]);
      }
    }
    tagOverlapScore = Math.min(1.0, 0.3 + matchPoints * 0.15);
  }

  // Blend vector score with hashtag matching
  if (user.interestEmbedding && post.embedding) {
    return vectorScore * 0.7 + tagOverlapScore * 0.3;
  }

  return tagOverlapScore;
}

/**
 * Combined Hybrid Scoring Formula:
 * FinalScore = (α * S_heur + (1 - α) * S_ML) * Decay(T)
 *
 * Cold-start handling: If user has no embedding and no hashtag interactions,
 * α is dynamically forced to 1.0 (100% heuristic/trending).
 */
export function scoreCandidate(
  post: PostCandidate,
  user?: UserInterestProfile,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  nowMs: number = Date.now()
): ScoredCandidate {
  const heuristicScore = calculateHeuristicScore(post, weights);
  const decayFactor = calculateTimeDecay(post.createdAt, nowMs, weights.timeDecayGravity);

  // Check cold start: User has no embedding and no interaction history
  const isColdStart =
    !user ||
    (!user.interestEmbedding &&
      (!user.engagedHashtags || Object.keys(user.engagedHashtags).length === 0));

  const effectiveAlpha = isColdStart ? 1.0 : weights.alpha;
  const semanticScore = calculateSemanticAffinity(post, user);

  // Normalized hybrid component
  const hybridCore =
    effectiveAlpha * heuristicScore + (1.0 - effectiveAlpha) * (semanticScore * 20.0);

  const finalScore = hybridCore * decayFactor;

  return {
    post,
    heuristicScore,
    semanticScore,
    decayFactor,
    finalScore,
    breakdown: {
      engagement: heuristicScore,
      decay: decayFactor,
      affinity: semanticScore,
    },
  };
}
