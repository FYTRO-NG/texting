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
