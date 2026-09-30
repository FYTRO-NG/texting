import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Database and Security
from database import connect_to_mongo, close_mongo_connection, db
import routes_auth
import routes_posts
import routes_social
import routes_features
import routes_media

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to MongoDB Atlas / Local
    await connect_to_mongo()
    yield
    # Shutdown: clean close
    await close_mongo_connection()

app = FastAPI(title="Private Voices API", lifespan=lifespan)

STATIC_DIR = Path(__file__).parent / "static"
if not STATIC_DIR.exists():
    ALT_STATIC = Path(__file__).parent.parent / "frontend" / "dist"
    if ALT_STATIC.exists():
        STATIC_DIR = ALT_STATIC

@app.get("/")
async def root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "service": "Private Voices API",
        "status": "online",
        "api_docs": "/docs",
        "database": "MongoDB Atlas" if os.environ.get("MONGO_URL") else "local"
    }

# Main API Router
api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def api_root():
    return {
        "service": "Private Voices API",
        "status": "online",
        "database": "MongoDB Atlas" if os.environ.get("MONGO_URL") else "local"
    }

@api_router.get("/health")
async def health_check():
    import database
    db = database.get_database()
    try:
        if database.client:
            await database.client.admin.command('ping')
            return {"status": "ok", "mongo": "connected", "db_name": database.get_db_name()}
        return {"status": "error", "mongo": "client is None"}
    except Exception as e:
        return {"status": "error", "error": str(e), "type": type(e).__name__}

# Register Feature Routers
api_router.include_router(routes_auth.router)
api_router.include_router(routes_posts.router)
api_router.include_router(routes_social.router_whispers)
api_router.include_router(routes_social.router_users)
api_router.include_router(routes_features.router_stories)
api_router.include_router(routes_features.router_communities)
api_router.include_router(routes_features.router_chats)
api_router.include_router(routes_media.router)

app.include_router(api_router)

# Mount /uploads for static media serving
uploads_path = Path(__file__).parent / "uploads"
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Expo Web App (if exported to backend/static or frontend/dist)
if STATIC_DIR.exists():
    app.mount("/_expo", StaticFiles(directory=STATIC_DIR / "_expo"), name="expo")
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't hijack API or uploads routes
        if full_path.startswith("api") or full_path.startswith("uploads") or full_path.startswith("docs"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"service": "Private Voices API", "status": "online"}

