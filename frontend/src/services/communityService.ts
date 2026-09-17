import { db, functions } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Community } from "../mockData";

export interface CommunityFull {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  visibility: "public" | "private";
  requireApproval: boolean;
  allowAnonymousPosts: boolean;
  avatarUrl?: string;
  coverUrl?: string;
  emoji?: string;
  ownerId: string;
  memberCount: number;
  postCount: number;
  rules: string[];
  joined?: boolean;
  createdAt?: any;
}

// ─── Callables ───
const _createCommunity = httpsCallable<any, { success: boolean; communityId: string }>(functions, "createCommunity");
const _joinCommunity = httpsCallable<{ communityId: string }, { success: boolean; status: string }>(functions, "joinCommunity");
const _leaveCommunity = httpsCallable<{ communityId: string }, { success: boolean; status: string }>(functions, "leaveCommunity");

export const createCommunityInFirestore = async (data: {
  name: string;
  slug: string;
  description: string;
  category: string;
  visibility: "public" | "private";
  requireApproval: boolean;
  rules: string[];
  allowAnonymousPosts: boolean;
  avatarUrl?: string;
  coverUrl?: string;
}): Promise<{ success: boolean; communityId: string }> => {
  try {
    const result = await _createCommunity(data);
    if (result.data && result.data.success) return result.data;
  } catch (funcErr) {
    console.warn("Cloud Function createCommunity unavailable, falling back to direct Firestore:", funcErr);
  }

  // Fallback: Direct Firestore creation
  const communityId = data.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");
  const commRef = doc(db, "communities", communityId);
  const ownerId = auth?.currentUser?.uid || "anon-user";

  await setDoc(commRef, {
    name: data.name,
    slug: communityId,
    description: data.description,
    category: data.category,
    visibility: data.visibility,
    requireApproval: data.requireApproval,
    allowAnonymousPosts: data.allowAnonymousPosts,
    rules: data.rules,
    avatarUrl: data.avatarUrl || null,
    coverUrl: data.coverUrl || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80",
    ownerId,
    memberCount: 1,
    postCount: 0,
    createdAt: serverTimestamp(),
  });

  return { success: true, communityId };
};

export const joinCommunityCallable = async (communityId: string) => {
  const result = await _joinCommunity({ communityId });
  return result.data;
};

export const leaveCommunityCallable = async (communityId: string) => {
  const result = await _leaveCommunity({ communityId });
  return result.data;
};

export const subscribeToCommunities = (callback: (communities: Community[]) => void) => {
  const commRef = collection(db, "communities");
  return onSnapshot(
    commRef,
    (snapshot) => {
      const list: Community[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name,
          emoji: data.emoji || "💬",
          description: data.description,
          members: `${data.memberCount || 0} members`,
          cover: data.coverUrl || data.cover || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80",
          gradient: data.gradient || ["#06B6D4", "#0284C7"],
          joined: false,
        };
      });
      callback(list);
    },
    (err) => {
      console.warn("Firestore communities listener subscription warning:", err);
      callback([]);
    }
  );
};

export const getCommunityDetails = async (idOrSlug: string): Promise<CommunityFull | null> => {
  const ref = doc(db, "communities", idOrSlug);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return {
      id: snap.id,
      name: data.name,
      slug: data.slug || snap.id,
      description: data.description,
      category: data.category || "General",
      visibility: data.visibility || "public",
      requireApproval: !!data.requireApproval,
      allowAnonymousPosts: data.allowAnonymousPosts !== false,
      avatarUrl: data.avatarUrl,
      coverUrl: data.coverUrl || data.cover,
      emoji: data.emoji || "💬",
      ownerId: data.ownerId,
      memberCount: data.memberCount || 0,
      postCount: data.postCount || 0,
      rules: data.rules || [
        "Be kind and respectful to all members.",
        "No harassment, hate speech, or targeted hate.",
        "Respect poster anonymity at all times.",
        "Keep discussions relevant to the community category."
      ],
      createdAt: data.createdAt,
    };
  }
  return null;
};

export const toggleJoinCommunityInFirestore = async (
  communityId: string,
  userId: string,
  currentlyJoined: boolean
) => {
  if (currentlyJoined) {
    await leaveCommunityCallable(communityId).catch(async () => {
      // Fallback client update
      await updateDoc(doc(db, "users", userId), { joinedCommunities: arrayRemove(communityId) });
      await updateDoc(doc(db, "communities", communityId), { memberCount: increment(-1) });
    });
  } else {
    await joinCommunityCallable(communityId).catch(async () => {
      // Fallback client update
      await updateDoc(doc(db, "users", userId), { joinedCommunities: arrayUnion(communityId) });
      await updateDoc(doc(db, "communities", communityId), { memberCount: increment(1) });
    });
  }
};
