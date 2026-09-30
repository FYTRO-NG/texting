import os
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from security import get_optional_user

router = APIRouter(prefix="/media", tags=["media"])

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".m4a", ".mp3"}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_optional_user)
):
    """
    Accepts media file upload (images, voice notes, story videos)
    and saves it to storage, returning public direct URL.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"

    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / unique_filename

    try:
        contents = await file.read()
        # Max file size limit: 15MB
        if len(contents) > 15 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 15MB limit")

        with open(file_path, "wb") as f:
            f.write(contents)

        # Base URL for public access
        base_url = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("APP_URL") or "https://private-voices-api.onrender.com"
        file_url = f"{base_url}/uploads/{unique_filename}"

        return {
            "success": True,
            "url": file_url,
            "filename": unique_filename,
            "size": len(contents)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload media: {str(e)}")
