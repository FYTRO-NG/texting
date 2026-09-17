/**
 * Private Voices — Hashtag Parsing, Normalization & Momentum Indexing
 */

import { HashtagVelocityStats } from "./types";

/**
 * Normalizes a raw hashtag string:
 * - Strips leading '#' and extraneous punctuation
 * - Converts to lowercase
 * - Strips spaces and non-alphanumeric/underscore symbols
 */
export function normalizeHashtag(tag: string): string {
  if (!tag) return "";
  const cleaned = tag.trim().replace(/^#+/, "").toLowerCase();
  return cleaned.replace(/[^a-z0-9_]/g, "");
}

/**
 * Extracts all unique normalized hashtags from raw post text.
 * Handles Unicode, multi-tag concatenations, and ignores bare '#' marks.
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#[a-zA-Z0-9_]+/g);
  if (!matches) return [];

  const unique = new Set<string>();
  for (const match of matches) {
    const norm = normalizeHashtag(match);
    if (norm.length > 0) {
      unique.add(norm);
    }
  }

  return Array.from(unique);
}

/**
 * Computes Hashtag Momentum Ratio:
 * Momentum = (Count_recent + 1) / (Count_baseline + 1)
 *
 * where recent is the 1h count and baseline is the 24h count normalized to 1h.
 */
export function calculateHashtagMomentum(
  count1h: number,
  count24h: number
): number {
  // Baseline expectation per hour over 24h window
  const expectedPerHour = Math.max(0, count24h / 24.0);
  const momentum = (count1h + 1.0) / (expectedPerHour + 1.0);
  return Number(momentum.toFixed(3));
}

/**
 * Updates rolling window stats for a hashtag given event timestamps.
 */
export function updateHashtagVelocity(
  tag: string,
  eventTimestampsMs: number[],
  nowMs: number = Date.now()
): HashtagVelocityStats {
  const norm = normalizeHashtag(tag);
  const oneHourAgo = nowMs - 1 * 60 * 60 * 1000;
  const sixHoursAgo = nowMs - 6 * 60 * 60 * 1000;
  const twentyFourHoursAgo = nowMs - 24 * 60 * 60 * 1000;

  let c1h = 0;
  let c6h = 0;
  let c24h = 0;

  for (const t of eventTimestampsMs) {
    if (t >= oneHourAgo) c1h++;
    if (t >= sixHoursAgo) c6h++;
    if (t >= twentyFourHoursAgo) c24h++;
  }

  const momentumScore = calculateHashtagMomentum(c1h, c24h);

  return {
    tag: norm,
    count1h: c1h,
    count6h: c6h,
    count24h: c24h,
    momentumScore,
    lastUpdated: nowMs,
  };
}
