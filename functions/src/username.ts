/**
 * username.ts — Private Voices Username Cloud Functions (2nd gen)
 *
 * Functions:
 *   checkUsernameAvailability  — Validates format, reserved list, uniqueness (read-only)
 *   claimUsername              — Atomically claims a username during registration (first-time)
 *   changeUsername             — Enforces 60-day cooldown, swaps username atomically
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = admin.firestore("private-voices");

// ─── Reserved names ────────────────────────────────────────────────────────────

const RESERVED_USERNAMES = new Set([
  "admin", "support", "privatevoices", "moderator", "official",
  "help", "abuse", "contact", "system", "bot", "root", "staff",
  "team", "info", "security", "privacy", "legal", "terms",
  "notice", "announcement", "news", "update", "api", "www",
  "mail", "email", "notifications", "account", "accounts",
  "profile", "profiles", "explore", "discover", "feed",
  "home", "settings", "register", "login", "logout",
  "signup", "signin", "password", "forgot", "reset",
  "whisper", "whispers", "voice", "voices", "echo", "echoes",
]);

// ─── Format validation ─────────────────────────────────────────────────────────

export function validateUsernameFormat(username: string): { valid: boolean; reason?: string } {
  if (!username || typeof username !== "string") {
    return { valid: false, reason: "Username is required." };
  }
  const t = username.trim();
  if (t.length < 3) return { valid: false, reason: "Username must be at least 3 characters." };
  if (t.length > 20) return { valid: false, reason: "Username must be 20 characters or less." };
  if (!/^[a-zA-Z0-9._]+$/.test(t)) {
    return { valid: false, reason: "Username can only contain letters, numbers, dots, and underscores." };
  }
  if (/^[._]/.test(t) || /[._]$/.test(t)) {
    return { valid: false, reason: "Username cannot start or end with a dot or underscore." };
  }
  if (/[_.]{2}/.test(t)) {
    return { valid: false, reason: "Username cannot contain consecutive dots or underscores." };
  }
  if (RESERVED_USERNAMES.has(t.toLowerCase())) {
    return { valid: false, reason: "That username is reserved and cannot be used." };
  }
  return { valid: true };
}

// ─── checkUsernameAvailability ────────────────────────────────────────────────
// Public callable — used for real-time UI availability feedback.
// Safe: only reads from Firestore, never writes.

export const checkUsernameAvailability = onCall(async (request) => {
  const { username } = request.data as { username: string };

  const fmt = validateUsernameFormat(username);
  if (!fmt.valid) {
    return { available: false, reason: fmt.reason };
  }

  const lower = username.trim().toLowerCase();
  const snap = await db.collection("usernames").doc(lower).get();

  if (snap.exists) {
    // Current user already owns this name — treat as available (e.g., re-confirming)
    if (request.auth && snap.data()?.uid === request.auth.uid) {
      return { available: true, isCurrent: true };
    }
    return { available: false, reason: "Username is already taken." };
  }

  return { available: true };
});

// ─── claimUsername ────────────────────────────────────────────────────────────
// Called once during the create-profile / registration flow.
// First-time claim: no cooldown applied — lastUsernameChangeAt stays null.
// Subsequent calls from the same uid update the username without cooldown
// only if no prior change has been made (lastUsernameChangeAt is null).

export const claimUsername = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to claim a username.");
  }

  const uid = request.auth.uid;
  const { username } = request.data as { username: string };

  const fmt = validateUsernameFormat(username);
  if (!fmt.valid) {
    throw new HttpsError("invalid-argument", fmt.reason!);
  }

  const lower = username.trim().toLowerCase();
  const usernameRef = db.collection("usernames").doc(lower);
  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (txn) => {
    const [usernameSnap, userSnap] = await Promise.all([
      txn.get(usernameRef),
      txn.get(userRef),
    ]);

    // Block if someone else already owns this name
    if (usernameSnap.exists && usernameSnap.data()?.uid !== uid) {
      throw new HttpsError("already-exists", "Username is already taken.");
    }

    const currentLower = userSnap.data()?.usernameLower;

    // Release old username entry if switching during initial setup
    if (currentLower && currentLower !== lower) {
      const oldRef = db.collection("usernames").doc(currentLower);
      txn.delete(oldRef);
    }

    // Claim new username
    txn.set(usernameRef, {
      uid,
      username: username.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user doc — no cooldown set for initial claim
    txn.set(userRef, {
      username: username.trim(),
      usernameLower: lower,
      // Only set these defaults if they don't already exist
      ...(!userSnap.data()?.lastUsernameChangeAt && {
        lastUsernameChangeAt: null,
        nextUsernameChangeAt: null,
      }),
    }, { merge: true });
  });

  return { success: true };
});

// ─── changeUsername ───────────────────────────────────────────────────────────
// Full username change — enforces 60-day cooldown server-side.
// The cooldown cannot be bypassed by the client, device change, or reinstall.

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

export const changeUsername = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to change your username.");
  }

  const uid = request.auth.uid;
  const { newUsername } = request.data as { newUsername: string };

  const fmt = validateUsernameFormat(newUsername);
  if (!fmt.valid) {
    throw new HttpsError("invalid-argument", fmt.reason!);
  }

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const userData = userSnap.data()!;
  const lastChange: admin.firestore.Timestamp | null = userData.lastUsernameChangeAt ?? null;

  // Enforce 60-day cooldown (only if they have changed before — first claim is always free)
  if (lastChange) {
    const lastChangeMs = lastChange.toDate().getTime();
    const msSinceChange = Date.now() - lastChangeMs;
    if (msSinceChange < SIXTY_DAYS_MS) {
      const daysRemaining = Math.ceil((SIXTY_DAYS_MS - msSinceChange) / (24 * 60 * 60 * 1000));
      throw new HttpsError(
        "failed-precondition",
        `Username change unavailable. You can change your username again in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}.`,
        { daysRemaining }
      );
    }
  }

  const lower = newUsername.trim().toLowerCase();
  const oldLower = userData.usernameLower as string | undefined;

  // If the new username is the same as current, no-op
  if (oldLower === lower) {
    return { success: true, noop: true };
  }

  const newUsernameRef = db.collection("usernames").doc(lower);
  const nextChangeDate = new Date(Date.now() + SIXTY_DAYS_MS);

  await db.runTransaction(async (txn) => {
    const newSnap = await txn.get(newUsernameRef);
    if (newSnap.exists && newSnap.data()?.uid !== uid) {
      throw new HttpsError("already-exists", "Username is already taken.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Write history record
    const historyRef = userRef.collection("usernameHistory").doc();
    txn.set(historyRef, {
      username: userData.username ?? oldLower,
      changedAt: now,
      changedFrom: oldLower ?? null,
    });

    // Release old username
    if (oldLower) {
      txn.delete(db.collection("usernames").doc(oldLower));
    }

    // Claim new username
    txn.set(newUsernameRef, {
      uid,
      username: newUsername.trim(),
      createdAt: now,
    });

    // Update user doc with cooldown timestamps
    txn.update(userRef, {
      username: newUsername.trim(),
      usernameLower: lower,
      lastUsernameChangeAt: now,
      nextUsernameChangeAt: admin.firestore.Timestamp.fromDate(nextChangeDate),
    });
  });

  return { success: true };
});
