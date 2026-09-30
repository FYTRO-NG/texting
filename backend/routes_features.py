from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
import database
from schemas import StoryCreate, StoryOut, CommunityCreate, CommunityOut, ChatMessageCreate, ChatMessageOut, ChatThreadOut
from security import get_current_user, get_optional_user

router_stories = APIRouter(prefix="/stories", tags=["stories"])
router_communities = APIRouter(prefix="/communities", tags=["communities"])
router_chats = APIRouter(prefix="/chats", tags=["chats"])

# ─── Stories Endpoints ─────────────────────────────────────────────────────────

@router_stories.get("", response_model=List[StoryOut])
async def get_active_stories(current_user: Optional[dict] = Depends(get_optional_user)):
    """
    Fetch all active, unexpired stories (created within the last 24 hours).
    """
    db = database.get_database()
    if db is None:
        return []

    now = datetime.utcnow()
    # MongoDB query: expiresAt > now
    cursor = db.stories.find({"expiresAt": {"$gt": now}}).sort("createdAt", 1)
    docs = await cursor.to_list(length=100)

    current_uid = current_user.get("uid") or current_user.get("_id") if current_user else None

    results = []
    for d in docs:
        viewers = d.get("viewers", [])
        is_viewed = False
        if current_uid:
            is_viewed = any(v.get("userId") == current_uid for v in viewers)

        created = d.get("createdAt")
        expires = d.get("expiresAt")

        results.append(StoryOut(
            id=str(d.get("_id") or d.get("id")),
            authorId=d.get("authorId", ""),
            authorUsername=d.get("authorUsername", "Anonymous"),
            authorAvatarIcon=d.get("authorAvatarIcon", "person"),
            authorAvatarGradient=d.get("authorAvatarGradient", ["#8B5CF6", "#06B6D4"]),
            type=d.get("type", "text"),
            content=d.get("content"),
            mediaUrl=d.get("mediaUrl"),
            backgroundColor=d.get("backgroundColor", "#8B5CF6"),
            viewCount=d.get("viewCount", 0),
            viewed=is_viewed,
            createdAt=created.isoformat() if isinstance(created, datetime) else None,
            expiresAt=expires.isoformat() if isinstance(expires, datetime) else None
        ))

    return results

@router_stories.post("", response_model=StoryOut)
async def create_story(
    input_data: StoryCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Publish a new story that expires automatically in 24 hours.
    """
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    story_id = str(uuid.uuid4())
    author_id = current_user.get("uid") or current_user.get("_id")
    now = datetime.utcnow()
    expires_at = now + timedelta(hours=24)

    story_doc = {
        "_id": story_id,
        "id": story_id,
        "authorId": author_id,
        "authorUsername": current_user.get("username", "Anonymous"),
        "authorAvatarIcon": current_user.get("avatarIcon", "person"),
        "authorAvatarGradient": current_user.get("avatarGradient", ["#8B5CF6", "#06B6D4"]),
        "type": input_data.type,
        "content": input_data.content,
        "mediaUrl": input_data.mediaUrl,
        "backgroundColor": input_data.backgroundColor or "#8B5CF6",
        "viewCount": 0,
        "viewers": [],
        "createdAt": now,
        "expiresAt": expires_at  # TTL index on MongoDB cleans this up automatically
    }

    await db.stories.insert_one(story_doc)

    return StoryOut(
        id=story_id,
        authorId=author_id,
        authorUsername=story_doc["authorUsername"],
        authorAvatarIcon=story_doc["authorAvatarIcon"],
        authorAvatarGradient=story_doc["authorAvatarGradient"],
        type=story_doc["type"],
        content=story_doc["content"],
        mediaUrl=story_doc["mediaUrl"],
        backgroundColor=story_doc["backgroundColor"],
        viewCount=0,
        viewed=False,
        createdAt=now.isoformat(),
        expiresAt=expires_at.isoformat()
    )

@router_stories.post("/{story_id}/view")
async def record_story_view(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Atomically track viewer sub-document and increment viewCount only once per viewer.
    """
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    viewer_id = current_user.get("uid") or current_user.get("_id")
    story = await db.stories.find_one({"_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found or expired")

    # Check if already viewed
    viewers = story.get("viewers", [])
    already_viewed = any(v.get("userId") == viewer_id for v in viewers)

    if not already_viewed:
        await db.stories.update_one(
            {"_id": story_id},
            {
                "$push": {"viewers": {"userId": viewer_id, "viewedAt": datetime.utcnow()}},
                "$inc": {"viewCount": 1}
            }
        )

    return {"success": True}

@router_stories.delete("/{story_id}")
async def delete_story(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Allow only the story owner to delete their active story.
    """
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    current_uid = current_user.get("uid") or current_user.get("_id")
    story = await db.stories.find_one({"_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    if story.get("authorId") != current_uid:
        raise HTTPException(status_code=403, detail="You can only delete your own stories")

    await db.stories.delete_one({"_id": story_id})
    return {"success": True}


# ─── Communities Endpoints ───────────────────────────────────────────────────

@router_communities.get("", response_model=List[CommunityOut])
async def get_communities(current_user: Optional[dict] = Depends(get_optional_user)):
    """
    List all communities with member counts and user joined state.
    """
    db = database.get_database()
    if db is None:
        return []

    cursor = db.communities.find().sort("members", -1).limit(50)
    docs = await cursor.to_list(length=50)

    # If no communities exist yet, seed standard Private Voices defaults
    if not docs:
        defaults = [
            {"_id": "tech", "name": "Technology & AI", "emoji": "⚡", "description": "Future of machines, privacy & web", "members": 124, "gradient": ["#06B6D4", "#3B82F6"]},
            {"_id": "mental-health", "name": "Deep Thoughts", "emoji": "🧠", "description": "Safe space for late night reflections", "members": 312, "gradient": ["#8B5CF6", "#EC4899"]},
            {"_id": "crypto", "name": "Decentralized", "emoji": "🔐", "description": "Cryptography, freedom and anonymous networks", "members": 89, "gradient": ["#10B981", "#06B6D4"]}
        ]
        await db.communities.insert_many(defaults)
        docs = defaults

    current_uid = current_user.get("uid") or current_user.get("_id") if current_user else None
    user_memberships = set()
    if current_uid:
        memberships = await db.community_members.find({"userId": current_uid}).to_list(100)
        user_memberships = {m.get("communityId") for m in memberships}

    results = []
    for d in docs:
        cid = str(d.get("_id") or d.get("id"))
        results.append(CommunityOut(
            id=cid,
            name=d.get("name", "Community"),
            emoji=d.get("emoji", "💬"),
            description=d.get("description", ""),
            members=d.get("members", 0),
            cover=d.get("cover"),
            gradient=d.get("gradient", ["#8B5CF6", "#06B6D4"]),
            joined=cid in user_memberships
        ))

    return results

@router_communities.post("", response_model=CommunityOut)
async def create_community(
    input_data: CommunityCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new community and automatically join as the creator.
    """
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    creator_id = current_user.get("uid") or current_user.get("_id")
    community_id = str(uuid.uuid4())

    doc = {
        "_id": community_id,
        "id": community_id,
        "name": input_data.name.strip(),
        "emoji": input_data.emoji or "💬",
        "description": input_data.description or "",
        "cover": input_data.cover,
        "gradient": input_data.gradient or ["#8B5CF6", "#06B6D4"],
        "members": 1,
        "ownerId": creator_id,
        "createdAt": datetime.utcnow()
    }

    await db.communities.insert_one(doc)
    # Record membership
    await db.community_members.insert_one({
        "communityId": community_id,
        "userId": creator_id,
        "role": "owner",
        "joinedAt": datetime.utcnow()
    })

    return CommunityOut(
        id=community_id,
        name=doc["name"],
        emoji=doc["emoji"],
        description=doc["description"],
        members=1,
        cover=doc["cover"],
        gradient=doc["gradient"],
        joined=True
    )

@router_communities.post("/{community_id}/join")
async def toggle_join_community(
    community_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Join or leave a community.
    """
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = current_user.get("uid") or current_user.get("_id")
    membership = await db.community_members.find_one({
        "communityId": community_id,
        "userId": user_id
    })

    if membership:
        # Leave
        await db.community_members.delete_one({"_id": membership["_id"]})
        await db.communities.update_one(
            {"_id": community_id, "members": {"$gt": 0}},
            {"$inc": {"members": -1}}
        )
        return {"joined": False}
    else:
        # Join
        await db.community_members.insert_one({
            "communityId": community_id,
            "userId": user_id,
            "role": "member",
            "joinedAt": datetime.utcnow()
        })
        await db.communities.update_one(
            {"_id": community_id},
            {"$inc": {"members": 1}}
        )
        return {"joined": True}


# ─── Chat / Direct Message Endpoints ──────────────────────────────────────────

@router_chats.get("", response_model=List[ChatThreadOut])
async def get_user_chat_threads(current_user: dict = Depends(get_current_user)):
    """
    List user's active direct message threads.
    """
    db = database.get_database()
    if db is None:
        return []

    uid = current_user.get("uid") or current_user.get("_id")
    cursor = db.chats.find({"participants": uid}).sort("updatedAt", -1).limit(50)
    docs = await cursor.to_list(length=50)

    results = []
    for d in docs:
        details = d.get("participantDetails", [])
        other = next((p for p in details if p.get("uid") != uid), None)
        other_uid = other.get("uid") if other else next((p for p in d.get("participants", []) if p != uid), "")

        created = d.get("updatedAt")
        time_str = "Just now"
        if isinstance(created, datetime):
            diff = (datetime.utcnow() - created).total_seconds()
            if diff < 60:
                time_str = "Just now"
            elif diff < 3600:
                time_str = f"{int(diff // 60)}m"
            else:
                time_str = f"{int(diff // 86400)}d"

        results.append(ChatThreadOut(
            id=str(d.get("_id") or d.get("id")),
            nickname=other.get("nickname", "Anonymous Voice") if other else "Anonymous Voice",
            avatarColor=other.get("avatarColor", ["#06B6D4", "#0284C7"]) if other else ["#06B6D4", "#0284C7"],
            avatarIcon=other.get("avatarIcon", "flash") if other else "flash",
            lastMessage=d.get("lastMessage", ""),
            time=time_str,
            unread=d.get("unreadCount", {}).get(uid, 0),
            online=True,
            otherUserId=other_uid
        ))

    return results

@router_chats.get("/{chat_id}/messages", response_model=List[ChatMessageOut])
async def get_chat_messages(
    chat_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch message history for a conversation.
    """
    db = database.get_database()
    if db is None:
        return []

    uid = current_user.get("uid") or current_user.get("_id")
    cursor = db.messages.find({"chatId": chat_id}).sort("createdAt", 1).limit(100)
    docs = await cursor.to_list(length=100)

    results = []
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

        results.append(ChatMessageOut(
            id=str(d.get("_id") or d.get("id")),
            senderId=d.get("senderId", ""),
            text=d.get("text", ""),
            time=time_str,
            fromMe=d.get("senderId") == uid,
            createdAt=created.isoformat() if isinstance(created, datetime) else None
        ))

    return results

@router_chats.post("/{chat_id}/messages", response_model=ChatMessageOut)
async def send_chat_message(
    chat_id: str,
    input_data: ChatMessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Send a direct message in a conversation.
    """
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    uid = current_user.get("uid") or current_user.get("_id")
    text = input_data.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    msg_id = str(uuid.uuid4())
    now = datetime.utcnow()

    msg_doc = {
        "_id": msg_id,
        "id": msg_id,
        "chatId": chat_id,
        "senderId": uid,
        "text": text,
        "createdAt": now
    }
    await db.messages.insert_one(msg_doc)

    # Update thread's lastMessage and updatedAt
    await db.chats.update_one(
        {"_id": chat_id},
        {
            "$set": {"lastMessage": text, "updatedAt": now},
            "$addToSet": {"participants": uid}
        },
        upsert=True
    )

    return ChatMessageOut(
        id=msg_id,
        senderId=uid,
        text=text,
        time="Just now",
        fromMe=True,
        createdAt=now.isoformat()
    )

