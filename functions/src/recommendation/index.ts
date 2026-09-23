/**
 * Private Voices — Firebase Cloud Functions for Recommendation & Hashtags
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { extractHashtags, normalizeHashtag } from "./hashtags";
import { runRecommendationPipeline } from "./pipeline";
import {
  DEFAULT_DIVERSITY_CONFIG,
  DEFAULT_SCORING_WEIGHTS,
  PostCandidate,
  ScoringWeights,
  UserInterestProfile,
} from "./types";

const db = admin.firestore("private-voices");

/**
 * Trigger: On Post Created -> Extract and index normalized hashtags
 */
export const onPostCreatedExtractHashtags = onDocumentCreated(
  "posts/{postId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || !data.text) return;

    const postId = event.params.postId;
    const tags = extractHashtags(data.text);
    if (tags.length === 0) return;

    const now = Date.now();
    const batch = db.batch();

    // 1. Update post document with extracted hashtags array
    const postRef = db.collection("posts").doc(postId);
    batch.update(postRef, {
      hashtags: tags,
      primaryHashtag: tags[0],
      hashtagsIndexedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Increment counters in hashtags collection
    for (const tag of tags) {
      const tagRef = db.collection("hashtags").doc(tag);
      batch.set(
        tagRef,
        {
          tag,
          postCount: admin.firestore.FieldValue.increment(1),
          recentPosts: admin.firestore.FieldValue.arrayUnion(postId),
          lastPostAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: now,
        },
        { merge: true }
      );
    }

    await batch.commit();
  }
);

/**
 * Callable: Pre-compute and refresh the cached explore bundle
 * Can be called by scheduled jobs or admin triggers.
 */
export const refreshExploreFeedBundle = onCall(async (request) => {
  // 1. Fetch system scoring configuration overrides if present
  let scoringWeights: ScoringWeights = DEFAULT_SCORING_WEIGHTS;
  try {
    const configSnap = await db.collection("system_configs").doc("recommendations").get();
    if (configSnap.exists) {
      scoringWeights = { ...DEFAULT_SCORING_WEIGHTS, ...configSnap.data() };
    }
  } catch (err) {
    console.warn("Using default scoring weights, config lookup failed:", err);
  }

  // 2. Fetch candidates from last 48 hours
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const postsSnap = await db
    .collection("posts")
    .where("status", "==", "published")
    .where("createdAt", ">=", twoDaysAgo)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const candidates: PostCandidate[] = postsSnap.docs.map((d) => {
    const raw = d.data();
    const createdAtMs = raw.createdAt?.toMillis
      ? raw.createdAt.toMillis()
      : raw.createdAt instanceof Date
      ? raw.createdAt.getTime()
      : Date.now();

    return {
      id: d.id,
      authorId: raw.authorId || raw.userId || "anon",
      username: raw.username || "Anonymous",
      avatarColor: raw.avatarColor || ["#8B5CF6", "#06B6D4"],
      avatarIcon: raw.avatarIcon || "person",
      community: raw.community || "General",
      communityEmoji: raw.communityEmoji || "💬",
      text: raw.text || "",
      image: raw.image,
      images: raw.images,
      likes: raw.likes || 0,
      commentsCount: raw.commentsCount || 0,
      reposts: raw.reposts || 0,
      negativeSignals: raw.reportsCount || 0,
      status: raw.status || "published",
      hashtags: raw.hashtags || extractHashtags(raw.text || ""),
      embedding: raw.embedding,
      createdAt: createdAtMs,
    };
  });

  // 3. Run Pipeline (Cold Start / Global Baseline)
  const ranked = runRecommendationPipeline(
    candidates,
    undefined, // global public feed
    scoringWeights,
    DEFAULT_DIVERSITY_CONFIG
  );

  const bundlePayload = {
    id: "global_trending",
    generatedAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour TTL
    algorithmVersion: "hybrid-v1.0",
    scoringWeights,
    posts: ranked.slice(0, 50).map((r) => ({
      id: r.post.id,
      finalScore: Number(r.finalScore.toFixed(4)),
      heuristicScore: Number(r.heuristicScore.toFixed(4)),
      semanticScore: Number(r.semanticScore.toFixed(4)),
    })),
  };

  await db.collection("explore_bundles").doc("global_trending").set(bundlePayload);

  return { success: true, count: bundlePayload.posts.length };
});

/**
 * Callable: Personalized Explore Feed
 * Takes optional user parameters, applies semantic re-ranking with fallbacks.
 */
export const getPersonalizedExploreFeed = onCall(async (request) => {
  const uid = request.auth?.uid;
  let userProfile: UserInterestProfile | undefined = undefined;

  if (uid) {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data() || {};
      userProfile = {
        uid,
        interestEmbedding: userData.interestEmbedding,
        engagedHashtags: userData.engagedHashtags || {},
        blockedUserIds: userData.blockedUsers || [],
        mutedHashtags: userData.mutedHashtags || [],
      };
    }
  }

  // 1. Fetch pre-computed bundle first for fast retrieval
  const bundleDoc = await db.collection("explore_bundles").doc("global_trending").get();
  
  if (bundleDoc.exists && (!userProfile || !userProfile.interestEmbedding)) {
    // Return pre-computed bundle directly for cold-start and anonymous requests
    const bundle = bundleDoc.data();
    return {
      source: "cached_bundle",
      posts: bundle?.posts || [],
      generatedAt: bundle?.generatedAt,
    };
  }

  // 2. Otherwise run dynamic ranking with user interest vector
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const postsSnap = await db
    .collection("posts")
    .where("status", "==", "published")
    .where("createdAt", ">=", twoDaysAgo)
    .orderBy("createdAt", "desc")
    .limit(60)
    .get();

  const candidates: PostCandidate[] = postsSnap.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      authorId: raw.authorId || raw.userId || "anon",
      username: raw.username || "Anonymous",
      avatarColor: raw.avatarColor || ["#8B5CF6", "#06B6D4"],
      avatarIcon: raw.avatarIcon || "person",
      community: raw.community || "General",
      communityEmoji: raw.communityEmoji || "💬",
      text: raw.text || "",
      image: raw.image,
      images: raw.images,
      likes: raw.likes || 0,
      commentsCount: raw.commentsCount || 0,
      reposts: raw.reposts || 0,
      status: raw.status || "published",
      hashtags: raw.hashtags || extractHashtags(raw.text || ""),
      embedding: raw.embedding,
      createdAt: raw.createdAt?.toMillis ? raw.createdAt.toMillis() : Date.now(),
    };
  });

  const ranked = runRecommendationPipeline(candidates, userProfile);

  return {
    source: "personalized_inference",
    posts: ranked.slice(0, 40).map((r) => ({
      id: r.post.id,
      finalScore: Number(r.finalScore.toFixed(4)),
      heuristicScore: Number(r.heuristicScore.toFixed(4)),
      semanticScore: Number(r.semanticScore.toFixed(4)),
    })),
  };
});
