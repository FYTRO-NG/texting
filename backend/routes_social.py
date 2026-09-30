from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
import uuid
import database
from schemas import WhisperCreate, WhisperOut, FollowAction
from security import get_current_user, get_optional_user

router_whispers = APIRouter(prefix="/whispers", tags=["whispers"])
router_users = APIRouter(prefix="/users", tags=["users"])

# --- Whispers Endpoints ---
@router_whispers.post("", response_model=dict)
async def send_whisper(
    input_data: WhisperCreate,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    clean_handle = input_data.recipientHandle.strip().replace("@", "").lower()
    text = input_data.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Whisper message cannot be empty")

    target_user = await db.users.find_one({"usernameLower": clean_handle})
    recipient_id = target_user.get("uid") or target_user.get("_id") if target_user else None

    whisper_id = str(uuid.uuid4())
    # STRICT PRIVACY: NEVER store sender's userId in anonymous whisper
    whisper_doc = {
        "_id": whisper_id,
        "id": whisper_id,
        "recipientHandle": clean_handle,
        "recipientId": recipient_id,
        "text": text,
        "mood": input_data.mood,
        "unread": True,
        "reactions": 0,
        "createdAt": datetime.utcnow()
    }

    await db.whispers.insert_one(whisper_doc)
    return {"success": True, "whisperId": whisper_id}

@router_whispers.get("/inbox", response_model=List[WhisperOut])
async def get_my_whispers(current_user: dict = Depends(get_current_user)):
    db = database.get_database()
    if db is None:
        return []

    handle = current_user.get("usernameLower", "")
    uid = current_user.get("uid") or current_user.get("_id")

    query = {
        "$or": [
            {"recipientHandle": handle},
            {"recipientId": uid}
        ]
    }

    cursor = db.whispers.find(query).sort("createdAt", -1).limit(100)
    docs = await cursor.to_list(length=100)

    result = []
    for d in docs:
        created = d.get("createdAt")
        time_str = "Just now"
        if isinstance(created, datetime):
            diff = (datetime.utcnow() - created).total_seconds()
            if diff < 60:
                time_str = "Just now"
            elif diff < 3600:
                time_str = f"{int(diff // 60)}m"
            else:
                time_str = f"{int(diff // 86400)}d"

        result.append(WhisperOut(
            id=str(d.get("_id") or d.get("id")),
            recipientHandle=d.get("recipientHandle", ""),
            message=d.get("text", ""),
            mood=d.get("mood"),
            time=time_str,
            unread=d.get("unread", True),
            reactions=d.get("reactions", 0),
            createdAt=created.isoformat() if isinstance(created, datetime) else None
        ))
    return result

# --- Follow & User Profile Endpoints ---
@router_users.post("/follow")
async def follow_user(
    action: FollowAction,
    current_user: dict = Depends(get_current_user)
):
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    current_uid = current_user.get("uid") or current_user.get("_id")
    target_uid = action.targetUid

    if current_uid == target_uid:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")

    target = await db.users.find_one({"_id": target_uid})
    if not target:
        target = await db.users.find_one({"uid": target_uid})
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    existing_follow = await db.follows.find_one({
        "followerId": current_uid,
        "followingId": target_uid
    })
    if existing_follow:
        return {"success": True, "already_following": True}

    follow_doc = {
        "_id": f"{current_uid}_{target_uid}",
        "followerId": current_uid,
        "followingId": target_uid,
        "createdAt": datetime.utcnow()
    }
    await db.follows.insert_one(follow_doc)

    # Increment counters atomically
    await db.users.update_one({"_id": current_uid}, {"$inc": {"followingCount": 1}})
    await db.users.update_one({"_id": target_uid}, {"$inc": {"followersCount": 1}})

    return {"success": True}

@router_users.post("/unfollow")
async def unfollow_user(
    action: FollowAction,
    current_user: dict = Depends(get_current_user)
):
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    current_uid = current_user.get("uid") or current_user.get("_id")
    target_uid = action.targetUid

    result = await db.follows.delete_one({
        "followerId": current_uid,
        "followingId": target_uid
    })

    if result.deleted_count > 0:
        # Decrement counters (ensure >= 0)
        await db.users.update_one(
            {"_id": current_uid, "followingCount": {"$gt": 0}},
            {"$inc": {"followingCount": -1}}
        )
        await db.users.update_one(
            {"_id": target_uid, "followersCount": {"$gt": 0}},
            {"$inc": {"followersCount": -1}}
        )

    return {"success": True}

@router_users.get("/profile/{handle}")
async def get_public_profile(handle: str, current_user: Optional[dict] = Depends(get_optional_user)):
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    clean_name = handle.strip().replace("@", "").lower()
    user = await db.users.find_one({"usernameLower": clean_name})
    if not user:
        # Try finding by direct ID
        user = await db.users.find_one({"_id": handle})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    target_uid = user.get("uid") or user.get("_id")
    is_following = False
    if current_user:
        current_uid = current_user.get("uid") or current_user.get("_id")
        follow_record = await db.follows.find_one({
            "followerId": current_uid,
            "followingId": target_uid
        })
        is_following = follow_record is not None

    return {
        "uid": target_uid,
        "username": user.get("username", "Anonymous"),
        "displayName": user.get("displayName", user.get("username")),
        "avatarIcon": user.get("avatarIcon", "person"),
        "avatarGradient": user.get("avatarGradient", ["#8B5CF6", "#06B6D4"]),
        "bio": user.get("bio", ""),
        "followersCount": user.get("followersCount", 0),
        "followingCount": user.get("followingCount", 0),
        "postsCount": user.get("postsCount", 0),
        "reputationScore": user.get("reputationScore", 100),
        "isFollowing": is_following
    }
