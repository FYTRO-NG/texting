/**
 * Private Voices — Diversity Enforcement & Feed Re-Ranking
 *
 * Implements greedy re-ranking and diversity caps:
 * 1. Author Cap: Max N posts from same author in a rolling window.
 * 2. Topic/Hashtag Diversity: Max M consecutive posts with identical primary hashtag.
 * 3. Media Balance: Balances text-only, single-image, and multi-image posts.
 */

import {
  DEFAULT_DIVERSITY_CONFIG,
  DiversityConfig,
  MediaCategory,
  ScoredCandidate,
} from "./types";

/**
 * Resolves media category for candidate balancing.
 */
export function resolveMediaCategory(candidate: ScoredCandidate): MediaCategory {
  const post = candidate.post;
  if (post.images && post.images.length > 1) return "multi_image";
  if ((post.images && post.images.length === 1) || post.image) return "single_image";
  return "text_only";
}

/**
 * Applies diversity constraints via greedy re-ranking.
 * Candidate list must already be ordered by descending finalScore.
 */
export function applyDiversityConstraints(
  rankedCandidates: ScoredCandidate[],
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG
): ScoredCandidate[] {
  if (!rankedCandidates || rankedCandidates.length === 0) {
    return [];
  }

  const result: ScoredCandidate[] = [];
  const deferredPool: ScoredCandidate[] = [];

  // Track recent author appearances in rolling window
  const authorOccurrencesInWindow = new Map<string, number>();

  // Track consecutive primary hashtag run
  let lastPrimaryTag = "";
  let consecutiveTagCount = 0;

  // Track consecutive same media category to ensure healthy interleaving
  let lastMediaCategory: MediaCategory | null = null;
  let consecutiveMediaCount = 0;

  for (const item of rankedCandidates) {
    const authorId = item.post.authorId;
    const authorCount = authorOccurrencesInWindow.get(authorId) || 0;

    // Rule 1: Author Cap in rolling window
    if (authorCount >= config.maxPostsPerAuthor) {
      deferredPool.push(item);
      continue;
    }

    // Rule 2: Consecutive primary hashtag cap
    const primaryTag = item.post.hashtags && item.post.hashtags.length > 0 ? item.post.hashtags[0] : "";
    if (primaryTag && primaryTag === lastPrimaryTag && consecutiveTagCount >= config.maxConsecutiveSameTopic) {
      deferredPool.push(item);
      continue;
    }

    // Rule 3: Media balance constraint (max 3 consecutive of identical media format)
    const mediaCat = resolveMediaCategory(item);
    if (config.enforceMediaBalance && mediaCat === lastMediaCategory && consecutiveMediaCount >= 3) {
      deferredPool.push(item);
      continue;
    }

    // Accept candidate into feed
    result.push(item);

    // Update author rolling window counts
    authorOccurrencesInWindow.set(authorId, authorCount + 1);
    if (result.length > config.authorWindowSize) {
      const expiredCandidate = result[result.length - config.authorWindowSize - 1];
      const prevAuthorCount = authorOccurrencesInWindow.get(expiredCandidate.post.authorId) || 0;
      if (prevAuthorCount > 1) {
        authorOccurrencesInWindow.set(expiredCandidate.post.authorId, prevAuthorCount - 1);
      } else {
        authorOccurrencesInWindow.delete(expiredCandidate.post.authorId);
      }
    }

    // Update consecutive tag streak
    if (primaryTag && primaryTag === lastPrimaryTag) {
      consecutiveTagCount++;
    } else {
      lastPrimaryTag = primaryTag;
      consecutiveTagCount = primaryTag ? 1 : 0;
    }

    // Update consecutive media streak
    if (mediaCat === lastMediaCategory) {
      consecutiveMediaCount++;
    } else {
      lastMediaCategory = mediaCat;
      consecutiveMediaCount = 1;
    }
  }

  // Backfill with deferred pool items at the tail of the feed
  for (const deferred of deferredPool) {
    if (!result.some((r) => r.post.id === deferred.post.id)) {
      // Check author occurrences in the current trailing window of result
      const trailingWindow = result.slice(-config.authorWindowSize);
      const authorInTrailing = trailingWindow.filter((r) => r.post.authorId === deferred.post.authorId).length;
      if (authorInTrailing < config.maxPostsPerAuthor) {
        result.push(deferred);
      }
    }
  }

  // Any remaining deferred items are appended to ensure no candidates are lost if result is small
  for (const deferred of deferredPool) {
    if (!result.some((r) => r.post.id === deferred.post.id)) {
      result.push(deferred);
    }
  }

  return result;
}
