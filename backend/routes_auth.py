from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
import uuid
import database
from schemas import UserRegister, UserLogin, TokenResponse, UserProfileOut, UsernameCheck
from security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
async def register(input_data: UserRegister):
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

    clean_username = input_data.username.strip()
    if len(clean_username) < 3 or len(clean_username) > 30:
        raise HTTPException(status_code=400, detail="Username must be between 3 and 30 characters")

    username_lower = clean_username.lower().replace("@", "")

    # Check if username exists
    existing_username = await db.users.find_one({"usernameLower": username_lower})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username is already taken")

    # Check if email exists
    clean_email = input_data.email.strip().lower()
    existing_email = await db.users.find_one({"email": clean_email})
    if existing_email:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    uid = str(uuid.uuid4())
    hashed_pwd = get_password_hash(input_data.password)

    user_doc = {
        "_id": uid,
        "uid": uid,
        "email": clean_email,
        "hashedPassword": hashed_pwd,
        "username": clean_username,
        "usernameLower": username_lower,
        "displayName": clean_username,
        "avatarIcon": input_data.avatarIcon or "person",
        "avatarGradient": input_data.avatarGradient or ["#8B5CF6", "#06B6D4"],
        "themeColor": input_data.themeColor or "#8B5CF6",
        "bio": input_data.bio or "",
        "reputationScore": 100,
        "anonymityLevel": 100,
        "followersCount": 0,
        "followingCount": 0,
        "postsCount": 0,
        "joinedAt": datetime.utcnow().isoformat(),
        "createdAt": datetime.utcnow()
    }

    await db.users.insert_one(user_doc)

    token = create_access_token({"sub": uid, "username": clean_username})
    safe_user = {k: v for k, v in user_doc.items() if k not in ["hashedPassword", "_id", "createdAt"]}

    return TokenResponse(access_token=token, user=safe_user)

@router.post("/login", response_model=TokenResponse)
async def login(input_data: UserLogin):
    db = database.get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

    clean_email = input_data.email.strip().lower()
    user = await db.users.find_one({"email": clean_email})
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not verify_password(input_data.password, user.get("hashedPassword", "")):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    uid = user.get("uid") or user.get("_id")
    token = create_access_token({"sub": uid, "username": user.get("username")})
    safe_user = {k: v for k, v in user.items() if k not in ["hashedPassword", "_id", "createdAt"]}

    return TokenResponse(access_token=token, user=safe_user)

@router.get("/me", response_model=UserProfileOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserProfileOut(
        uid=current_user.get("uid") or current_user.get("_id"),
        username=current_user.get("username", "Anonymous"),
        usernameLower=current_user.get("usernameLower", ""),
        email=current_user.get("email"),
        avatarIcon=current_user.get("avatarIcon", "person"),
        avatarGradient=current_user.get("avatarGradient", ["#8B5CF6", "#06B6D4"]),
        themeColor=current_user.get("themeColor", "#8B5CF6"),
        bio=current_user.get("bio", ""),
        reputationScore=current_user.get("reputationScore", 100),
        anonymityLevel=current_user.get("anonymityLevel", 100),
        followersCount=current_user.get("followersCount", 0),
        followingCount=current_user.get("followingCount", 0),
        postsCount=current_user.get("postsCount", 0),
        joinedAt=str(current_user.get("joinedAt", ""))
    )

@router.get("/check-username/{username}")
async def check_username(username: str):
    try:
        db = database.get_database()
        if db is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        clean_name = username.strip().lower().replace("@", "")
        existing = await db.users.find_one({"usernameLower": clean_name})
        return {"available": existing is None, "username": clean_name}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
