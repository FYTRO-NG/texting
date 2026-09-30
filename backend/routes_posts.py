from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
import uuid
import re
import database
from schemas import PostCreate, PostOut
from security import get_current_user, get_optional_user

router = APIRouter(prefix="/posts", tags=["posts"])

def parse_hashtags(text: str) -> List[str]:
    matches = re.findall(r"#[a-zA-Z0-9_]+", text)
    return [m.lower() for m in matches]

def format_post(doc: dict, current_user_id: Optional[str] = None) -> dict:
    created = doc.get("createdAt")
    time_str = "Just now"
    created_iso = None
    if isinstance(created, datetime):
        created_iso = created.isoformat()
        diff = (datetime.utcnow() - created).total_seconds()
        if diff < 60:
            time_str = "Just now"
        elif diff < 3600:
            time_str = f"{int(diff // 60)}m"
        elif diff < 86400:
            time_str = f"{int(diff // 3600)}h"
        else:
            time_str = f"{int(diff // 86400)}d"

    liked_by = doc.get("likedBy", [])
    saved_by = doc.get("savedBy", [])

    return {
        "id": str(doc.get("_id") or doc.get("id")),
        "username": doc.get("username", "Anonymous Voice"),
        "authorId": doc.get("authorId") or doc.get("userId", ""),
        "avatarColor": doc.get("avatarColor", ["#06B6D4", "#0284C7"]),
        "avatarIcon": doc.get("avatarIcon", "flash"),
        "community": doc.get("community", "General"),
        "communityEmoji": doc.get("communityEmoji", "💬"),
        "time": time_str,
        "text": doc.get("text", ""),
        "images": doc.get("images", []),
        "likes": doc.get("likes", 0),
        "comments": doc.get("commentsCount", 0),
        "reposts": doc.get("reposts", 0),
        "viewCount": doc.get("viewCount", 0),
        "liked": current_user_id in liked_by if current_user_id else False,
        "saved": current_user_id in saved_by if current_user_id else False,
        "createdAt": created_iso
    }

@router.get("", response_model=List[PostOut])
async def get_posts(
    limit: int = 50,
    community: Optional[str] = None,
    hashtag: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    db = database.get_database()
    if db is None:
        return []

    query = {}
    if community and community != "All":
        query["community"] = community
    if hashtag:
        query["hashtags"] = hashtag.lower()

    cursor = db.posts.find(query).sort("createdAt", -1).limit(min(limit, 100))
    posts = await cursor.to_list(length=limit)
    uid = current_user.get("uid") or current_user.get("_id") if current_user else None
    return [format_post(p, uid) for p in posts]

@router.post("", response_model=PostOut)
async def create_post(
    input_data: PostCreate,
    current_user: dict = Depends(get_current_user)
):
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    text = input_data.text.strip()
    if not text and not input_data.images:
        raise HTTPException(status_code=400, detail="Post must have text or an image")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Post text exceeds 2000 characters")

    post_id = str(uuid.uuid4())
    author_id = current_user.get("uid") or current_user.get("_id")
    hashtags = parse_hashtags(text)

    post_doc = {
        "_id": post_id,
        "id": post_id,
        "authorId": author_id,
        "userId": author_id,
        "username": current_user.get("username", "Anonymous"),
        "avatarColor": current_user.get("avatarGradient", ["#06B6D4", "#0284C7"]),
        "avatarIcon": current_user.get("avatarIcon", "flash"),
        "community": input_data.community or "General",
        "communityEmoji": input_data.communityEmoji or "💬",
        "text": text,
        "hashtags": hashtags,
        "images": input_data.images or [],
        "poll": input_data.poll,
        "replyPermission": input_data.replyPermission or "everyone",
        "visibility": input_data.visibility or "public",
        "likes": 0,
        "likedBy": [],
        "commentsCount": 0,
        "reposts": 0,
        "viewCount": 0,
        "savedBy": [],
        "createdAt": datetime.utcnow()
    }

    await db.posts.insert_one(post_doc)
    # Increment user's postsCount
    await db.users.update_one({"_id": author_id}, {"$inc": {"postsCount": 1}})

    return format_post(post_doc, author_id)

@router.post("/{post_id}/like")
async def toggle_like(post_id: str, current_user: dict = Depends(get_current_user)):
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    uid = current_user.get("uid") or current_user.get("_id")
    post = await db.posts.find_one({"_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    liked_by = post.get("likedBy", [])
    if uid in liked_by:
        # Unlike
        await db.posts.update_one(
            {"_id": post_id},
            {"$pull": {"likedBy": uid}, "$inc": {"likes": -1}}
        )
        return {"liked": False}
    else:
        # Like
        await db.posts.update_one(
            {"_id": post_id},
            {"$addToSet": {"likedBy": uid}, "$inc": {"likes": 1}}
        )
        return {"liked": True}
