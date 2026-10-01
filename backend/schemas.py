from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime

# --- Auth Models ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    username: str
    avatarIcon: Optional[str] = "person"
    avatarGradient: Optional[List[str]] = ["#8B5CF6", "#06B6D4"]
    themeColor: Optional[str] = "#8B5CF6"
    bio: Optional[str] = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserProfileOut(BaseModel):
    uid: str
    username: str
    usernameLower: str
    email: Optional[str] = None
    avatarIcon: str = "person"
    avatarGradient: List[str] = ["#8B5CF6", "#06B6D4"]
    themeColor: str = "#8B5CF6"
    bio: str = ""
    reputationScore: int = 100
    anonymityLevel: int = 100
    followersCount: int = 0
    followingCount: int = 0
    postsCount: int = 0
    joinedAt: Optional[str] = None

class UsernameCheck(BaseModel):
    username: str

# --- Post Models ---
class PostCreate(BaseModel):
    text: str
    community: Optional[str] = "General"
    communityEmoji: Optional[str] = "💬"
    images: Optional[List[dict]] = []
    poll: Optional[dict] = None
    replyPermission: Optional[str] = "everyone"
    visibility: Optional[str] = "public"

class PostOut(BaseModel):
    id: str
    username: str
    authorId: str
    avatarColor: List[str]
    avatarIcon: str
    community: str
    communityEmoji: str
    time: str
    text: str
    images: Optional[List[dict]] = []
    likes: int = 0
    comments: int = 0
    reposts: int = 0
    viewCount: int = 0
    liked: bool = False
    saved: bool = False
    createdAt: Optional[str] = None

# --- Whisper Models ---
class WhisperCreate(BaseModel):
    recipientHandle: str
    text: str
    mood: Optional[str] = None

class WhisperOut(BaseModel):
    id: str
    recipientHandle: str
    message: str
    mood: Optional[str] = None
    time: str
    unread: bool = True
    reactions: int = 0
    createdAt: Optional[str] = None

# --- Follow Models ---
class FollowAction(BaseModel):
    targetUid: str

# --- Story Models ---
class StoryCreate(BaseModel):
    type: str = "text"  # "text" | "image"
    content: Optional[str] = None
    mediaUrl: Optional[str] = None
    backgroundColor: Optional[str] = "#8B5CF6"

class StoryViewerAction(BaseModel):
    storyId: str

class StoryOut(BaseModel):
    id: str
    authorId: str
    authorUsername: str
    authorAvatarIcon: str
    authorAvatarGradient: List[str]
    type: str
    content: Optional[str] = None
    mediaUrl: Optional[str] = None
    backgroundColor: Optional[str] = None
    viewCount: int = 0
    viewed: bool = False
    createdAt: Optional[str] = None
    expiresAt: Optional[str] = None

# --- Community Models ---
class CommunityCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    emoji: Optional[str] = "💬"
    description: Optional[str] = ""
    cover: Optional[str] = None
    category: Optional[str] = None
    visibility: Optional[str] = "public"
    requireApproval: Optional[bool] = False
    rules: Optional[List[str]] = []
    allowAnonymousPosts: Optional[bool] = True
    gradient: Optional[List[str]] = ["#8B5CF6", "#06B6D4"]

class CommunityOut(BaseModel):
    id: str
    name: str
    emoji: str
    description: str
    members: int
    cover: Optional[str] = None
    gradient: List[str]
    joined: bool = False
    success: bool = True
    communityId: Optional[str] = None

# --- Chat Models ---
class ChatMessageCreate(BaseModel):
    text: str

class ChatMessageOut(BaseModel):
    id: str
    senderId: str
    text: str
    time: str
    fromMe: bool = False
    createdAt: Optional[str] = None

class ChatThreadOut(BaseModel):
    id: str
    nickname: str
    avatarColor: List[str]
    avatarIcon: str
    lastMessage: str
    time: str
    unread: int = 0
    online: bool = True
    otherUserId: str


