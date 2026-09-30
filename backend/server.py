import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware

# Database and Security
from database import connect_to_mongo, close_mongo_connection, db
import routes_auth
import routes_posts
import routes_social
import routes_features

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

@app.get("/")
async def root():
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

# Register Feature Routers
api_router.include_router(routes_auth.router)
api_router.include_router(routes_posts.router)
api_router.include_router(routes_social.router_whispers)
api_router.include_router(routes_social.router_users)
api_router.include_router(routes_features.router_stories)
api_router.include_router(routes_features.router_communities)

app.include_router(api_router)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
