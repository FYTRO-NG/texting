/**
 * Private Voices — Recommendation Engine Types & Configurations
 */

export interface ScoringWeights {
  alpha: number;             // Weight between heuristic (alpha) and ML semantic score (1 - alpha)
  likeWeight: number;        // Weight for likes (e.g. 1.0)
  replyWeight: number;       // Weight for comments/replies (e.g. 2.5)
  repostWeight: number;      // Weight for reposts/shares (e.g. 3.0)
  negativePenalty: number;   // Penalty for negative feedback/reports (e.g. -5.0)
  timeDecayGravity: number;  // Gravity exponent G in 1 / (T + 2)^G (e.g. 1.4)
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  alpha: 0.65,
  likeWeight: 1.0,
  replyWeight: 2.5,
  repostWeight: 3.0,
  negativePenalty: -5.0,
  timeDecayGravity: 1.4,
};

export interface DiversityConfig {
  maxPostsPerAuthor: number;      // e.g. 2 posts per author in a window
  authorWindowSize: number;       // e.g. 15 items window
  maxConsecutiveSameTopic: number;// e.g. 3 consecutive posts with same primary tag
  enforceMediaBalance: boolean;   // Ensures interleaving of text, single-img, multi-img
}

export const DEFAULT_DIVERSITY_CONFIG: DiversityConfig = {
  maxPostsPerAuthor: 2,
  authorWindowSize: 15,
  maxConsecutiveSameTopic: 3,
  enforceMediaBalance: true,
};

export type MediaCategory = "text_only" | "single_image" | "multi_image";

export interface PostCandidate {
  id: string;
  authorId: string;
  username: string;
  avatarColor: [string, string];
  avatarIcon: string;
  community: string;
  communityEmoji: string;
  text: string;
  image?: string;
  images?: Array<{ url: string; storagePath?: string }>;
  likes: number;
  commentsCount: number;
  reposts: number;
  negativeSignals?: number;
  status: "published" | "pending_review" | "flagged" | "hidden" | "deleted";
  hashtags: string[];
  embedding?: number[];
  createdAt: number; // Unix timestamp in ms
  mediaCategory?: MediaCategory;
}

export interface UserInterestProfile {
  uid: string;
  interestEmbedding?: number[];
  engagedHashtags?: Record<string, number>; // hashtag -> frequency
  blockedUserIds?: string[];
  mutedHashtags?: string[];
}

export interface ScoredCandidate {
  post: PostCandidate;
  heuristicScore: number;
  semanticScore: number;
  decayFactor: number;
  finalScore: number;
  breakdown: {
    engagement: number;
    decay: number;
    affinity: number;
  };
}

export interface HashtagVelocityStats {
  tag: string;
  count1h: number;
  count6h: number;
  count24h: number;
  momentumScore: number;
  lastUpdated: number;
}

export interface ExploreFeedBundle {
  id: string;
  generatedAt: number;
  expiresAt: number;
  algorithmVersion: string;
  scoringWeights: ScoringWeights;
  posts: Array<{
    id: string;
    finalScore: number;
    heuristicScore: number;
    semanticScore: number;
  }>;
}
