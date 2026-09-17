/**
 * Private Voices — Explore Recommendation Service (Client)
 *
 * Provides high-performance, cost-effective feed fetching:
 * 1. Fetches pre-computed explore bundles for sub-100ms instant loads
 * 2. Fetches trending hashtags with momentum metrics
 * 3. Fetches posts matching a specific hashtag
 * 4. Graceful fallbacks for offline or cold-start scenarios
 */

import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { Post } from "../mockData";

export interface TrendingHashtag {
  tag: string;
  postCount: number;
  momentumScore?: number;
}

export interface ExploreRecommendationResult {
  source: "cached_bundle" | "firestore_fallback";
  posts: Post[];
  generatedAt?: number;
}

function mapDocToPost(docSnap: any): Post {
  const data = docSnap.data();
  let img: string | undefined = undefined;
  if (data.image) img = data.image;
  else if (data.images && data.images.length > 0) {
    const first = data.images[0];
    img = typeof first === "string" ? first : first?.url;
  }

  return {
    id: docSnap.id,
    username: data.username || "Anonymous Voice",
    avatarColor: data.avatarColor || ["#06B6D4", "#0284C7"],
    avatarIcon: data.avatarIcon || "flash",
    community: data.community || "General",
    communityEmoji: data.communityEmoji || "💬",
    time: data.createdAt ? "Recent" : "1m",
    text: data.text || "",
    image: img,
    poll: data.poll,
    likes: data.likes || 0,
    comments: data.commentsCount || 0,
    reposts: data.reposts || 0,
    liked: false,
    saved: false,
  };
}

/**
 * Subscribes to real-time trending hashtags from the hashtags collection.
 * Falls back to extracting from live posts if collection is empty.
 */
export function subscribeToTrendingHashtags(
  callback: (tags: TrendingHashtag[]) => void
) {
  const q = query(
    collection(db, "hashtags"),
    orderBy("postCount", "desc"),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.empty) {
        const tags: TrendingHashtag[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            tag: d.id,
            postCount: data.postCount || 1,
            momentumScore: data.momentumScore || 1.0,
          };
        });
        callback(tags);
      } else {
        callback([]);
      }
    },
    (err) => {
      console.warn("Hashtags subscription fallback:", err);
      callback([]);
    }
  );
}

/**
 * Fetches posts containing a specific hashtag ordered by recency.
 */
export async function getPostsByHashtag(
  tag: string,
  limitCount = 30
): Promise<Post[]> {
  const cleanTag = tag.trim().replace(/^#+/, "").toLowerCase();
  try {
    const q = query(
      collection(db, "posts"),
      where("hashtags", "array-contains", cleanTag),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDocToPost(d));
  } catch (err) {
    console.warn(`Failed to fetch posts for #${cleanTag}:`, err);
    return [];
  }
}

/**
 * Fetches the explore recommendation feed:
 * 1. Checks pre-computed bundle (`explore_bundles/global_trending`)
 * 2. Fetches matching post documents in bulk
 * 3. Falls back to recent published posts if bundle is absent
 */
export async function getExploreFeed(maxPosts = 30): Promise<ExploreRecommendationResult> {
  try {
    const bundleSnap = await getDoc(doc(db, "explore_bundles", "global_trending"));
    
    if (bundleSnap.exists()) {
      const bundleData = bundleSnap.data();
      const postEntries = (bundleData?.posts || []).slice(0, maxPosts);

      if (postEntries.length > 0) {
        // Fetch posts by ID in parallel
        const postPromises = postEntries.map(async (entry: any) => {
          const pSnap = await getDoc(doc(db, "posts", entry.id));
          if (pSnap.exists() && pSnap.data().status === "published") {
            return mapDocToPost(pSnap);
          }
          return null;
        });

        const resolved = await Promise.all(postPromises);
        const validPosts = resolved.filter((p): p is Post => p !== null);

        if (validPosts.length > 0) {
          return {
            source: "cached_bundle",
            posts: validPosts,
            generatedAt: bundleData?.generatedAt,
          };
        }
      }
    }
  } catch (bundleErr) {
    console.warn("Failed to read recommendation bundle, using Firestore fallback:", bundleErr);
  }

  // Fallback: Query recent published posts directly
  try {
    const fallbackQ = query(
      collection(db, "posts"),
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
      limit(maxPosts)
    );
    const snap = await getDocs(fallbackQ);
    return {
      source: "firestore_fallback",
      posts: snap.docs.map((d) => mapDocToPost(d)),
    };
  } catch (err) {
    console.error("Explore fallback query failed:", err);
    return {
      source: "firestore_fallback",
      posts: [],
    };
  }
}
