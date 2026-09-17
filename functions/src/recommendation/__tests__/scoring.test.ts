/**
 * Private Voices — Verification Test Suite for Recommendation Engine
 *
 * Tests:
 * 1. Heuristic & Hybrid Scoring Formula
 * 2. Time Decay Gravity
 * 3. Cold Start Fallback vs. Semantic Vector Affinity
 * 4. Hashtag Extraction, Normalization & Momentum
 * 5. Safety Moderation Gating
 * 6. Author, Topic & Media Diversity Constraints
 */

import {
  calculateEngagementVelocity,
  calculateHeuristicScore,
  calculateSemanticAffinity,
  calculateTimeDecay,
  computeCosineSimilarity,
  scoreCandidate,
} from "../scoring";
import {
  calculateHashtagMomentum,
  extractHashtags,
  normalizeHashtag,
  updateHashtagVelocity,
} from "../hashtags";
import {
  applyDiversityConstraints,
  resolveMediaCategory,
} from "../diversity";
import {
  passesSafetyModeration,
  runRecommendationPipeline,
} from "../pipeline";
import {
  DEFAULT_DIVERSITY_CONFIG,
  DEFAULT_SCORING_WEIGHTS,
  PostCandidate,
  UserInterestProfile,
} from "../types";

// Simple test assertion helper
function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

function runTests() {
  console.log("\n==========================================");
  console.log("RUNNING EXPLORE RECOMMENDATION ENGINE TESTS");
  console.log("==========================================\n");

  const now = Date.now();

  // ─────────────────────────────────────────────────────────
  // TEST 1: Heuristic Scoring & Weights
  // ─────────────────────────────────────────────────────────
  console.log("1. Testing Heuristic Scoring & Weights:");
  const testPost1: PostCandidate = {
    id: "p1",
    authorId: "u1",
    username: "alice",
    avatarColor: ["#000", "#fff"],
    avatarIcon: "person",
    community: "Tech",
    communityEmoji: "💻",
    text: "Exploring decentralized tech #crypto #privacy",
    likes: 10,
    commentsCount: 4,
    reposts: 2,
    negativeSignals: 0,
    status: "published",
    hashtags: ["crypto", "privacy"],
    createdAt: now - 3600 * 1000, // 1 hour ago
  };

  const hScore = calculateHeuristicScore(testPost1, DEFAULT_SCORING_WEIGHTS);
  // (10 * 1.0) + (4 * 2.5) + (2 * 3.0) + 0 + 1.0 = 10 + 10 + 6 + 1 = 27
  assert(hScore === 27, `Heuristic score matches formula (expected 27, got ${hScore})`);

  // ─────────────────────────────────────────────────────────
  // TEST 2: Time Decay Gravity
  // ─────────────────────────────────────────────────────────
  console.log("\n2. Testing Time Decay Gravity:");
  const decay0h = calculateTimeDecay(now, now, 1.4); // 1 / (2^1.4) ≈ 0.3789
  const decay24h = calculateTimeDecay(now - 24 * 3600 * 1000, now, 1.4); // 1 / (26^1.4) ≈ 0.0105
  assert(decay0h > decay24h, "Recent posts have significantly higher decay factor than older posts");
  assert(decay24h > 0, "Decay factor is strictly positive");

  // ─────────────────────────────────────────────────────────
  // TEST 3: Cold Start Fallback vs. Semantic Vector Affinity
  // ─────────────────────────────────────────────────────────
  console.log("\n3. Testing Cold Start Fallback vs Semantic Affinity:");
  // A. Cold start user (no embedding, no interactions)
  const coldStartScored = scoreCandidate(testPost1, undefined, DEFAULT_SCORING_WEIGHTS, now);
  assert(coldStartScored.finalScore > 0, "Cold start user yields non-zero valid score");

  // B. User with interest embedding matching post embedding
  const userVec = [1.0, 0.5, 0.0];
  const postVec = [1.0, 0.5, 0.0]; // Cosine sim = 1.0
  const postWithEmbed: PostCandidate = { ...testPost1, embedding: postVec };
  const userProfile: UserInterestProfile = {
    uid: "u_target",
    interestEmbedding: userVec,
    engagedHashtags: { privacy: 5 },
  };

  const sim = computeCosineSimilarity(userVec, postVec);
  assert(sim > 0.99, `Identical vector cosine similarity is 1.0 (got ${sim})`);

  const affinity = calculateSemanticAffinity(postWithEmbed, userProfile);
  assert(affinity > 0.8, `High semantic affinity for matching profile (got ${affinity})`);

  // ─────────────────────────────────────────────────────────
  // TEST 4: Hashtag Parsing, Normalization & Momentum
  // ─────────────────────────────────────────────────────────
  console.log("\n4. Testing Hashtag Parsing, Normalization & Momentum:");
  const sampleText = "Welcome to #PrivateVoices! Enjoy #crypto, #Web3.0 and #privacy#safety!!";
  const tags = extractHashtags(sampleText);
  assert(tags.includes("privatevoices"), "Extracts and lowercases hashtag #PrivateVoices");
  assert(tags.includes("crypto"), "Extracts #crypto");
  assert(tags.includes("privacy"), "Extracts #privacy");
  assert(tags.includes("safety"), "Extracts #safety from concatenated tags");

  assert(normalizeHashtag("#Tech_Talk!") === "tech_talk", "Normalizes tag correctly");

  const momentum = calculateHashtagMomentum(12, 48); // 12 in 1h vs 48 in 24h (2/h expected) -> (12+1)/(2+1) = 4.333
  assert(momentum > 4.0, `Calculates momentum ratio correctly (expected >4.0, got ${momentum})`);

  // ─────────────────────────────────────────────────────────
  // TEST 5: Safety Moderation Gating
  // ─────────────────────────────────────────────────────────
  console.log("\n5. Testing Safety Moderation Gating:");
  const pendingPost: PostCandidate = { ...testPost1, id: "p_pend", status: "pending_review" };
  assert(!passesSafetyModeration(pendingPost, userProfile), "Immediately excludes pending_review posts");

  const flaggedPost: PostCandidate = { ...testPost1, id: "p_flag", status: "flagged" };
  assert(!passesSafetyModeration(flaggedPost, userProfile), "Immediately excludes flagged posts");

  const toxicPost: PostCandidate = { ...testPost1, id: "p_tox", text: "Free bitcoin send crypto to http://scam" };
  assert(!passesSafetyModeration(toxicPost, userProfile), "Immediately excludes phishing scam patterns");

  const blockedPost: PostCandidate = { ...testPost1, id: "p_block", authorId: "bad_actor" };
  const userWithBlock: UserInterestProfile = { ...userProfile, blockedUserIds: ["bad_actor"] };
  assert(!passesSafetyModeration(blockedPost, userWithBlock), "Excludes posts from blocked users");

  // ─────────────────────────────────────────────────────────
  // TEST 6: Author, Topic & Media Diversity Constraints
  // ─────────────────────────────────────────────────────────
  console.log("\n6. Testing Diversity & Re-Ranking Constraints:");
  // Create 6 posts from the same author
  const repeatedAuthorPosts: PostCandidate[] = Array.from({ length: 6 }, (_, i) => ({
    ...testPost1,
    id: `author_same_${i}`,
    authorId: "monopolist_author",
    likes: 100 - i * 5, // high scores
  }));

  const otherPosts: PostCandidate[] = Array.from({ length: 4 }, (_, i) => ({
    ...testPost1,
    id: `other_author_${i}`,
    authorId: `different_author_${i}`,
    likes: 20 - i, // lower scores
  }));

  const allCandidates = [...repeatedAuthorPosts, ...otherPosts];
  const diversified = runRecommendationPipeline(
    allCandidates,
    undefined,
    DEFAULT_SCORING_WEIGHTS,
    DEFAULT_DIVERSITY_CONFIG,
    now
  );

  // Check that the top 4 results do not have more than 2 from the monopolist author
  const top4Authors = diversified.slice(0, 4).map((d) => d.post.authorId);
  const monopolistCount = top4Authors.filter((a) => a === "monopolist_author").length;
  assert(monopolistCount <= 2, `Author cap enforced: max 2 from same author in top window (got ${monopolistCount})`);

  console.log("\n==========================================");
  console.log("ALL 6 TEST SUITES PASSED SUCCESSFULLY! ✅");
  console.log("==========================================\n");
}

runTests();
