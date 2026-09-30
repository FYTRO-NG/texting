import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
import logging

import certifi

logger = logging.getLogger(__name__)

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "private_voices")

client: AsyncIOMotorClient = None
db = None

async def connect_to_mongo():
    global client, db
    try:
        logger.info(f"Connecting to MongoDB at {MONGO_URL.split('@')[-1]}...")
        
        # Use certifi CA file when connecting via SSL/TLS
        client_kwargs = {
            "serverSelectionTimeoutMS": 10000,
        }
        if "mongodb+srv://" in MONGO_URL or "ssl=true" in MONGO_URL.lower():
            client_kwargs["tlsCAFile"] = certifi.where()

        client = AsyncIOMotorClient(MONGO_URL, **client_kwargs)
        db = client[DB_NAME]
        
        # Verify connection
        await client.admin.command('ping')
        logger.info("MongoDB connection established successfully.")
        
        # Initialize critical collections and indexes
        await init_db_indexes(db)
    except Exception as e:
        logger.warning(f"Could not connect to MongoDB immediately: {e}")
        # Allow server to start even if offline or waiting for Atlas credentials

async def close_mongo_connection():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed.")

async def init_db_indexes(database):
    try:
        # Users indexes
        await database.users.create_index([("usernameLower", ASCENDING)], unique=True, sparse=True)
        await database.users.create_index([("email", ASCENDING)], unique=True, sparse=True)

        # Posts indexes
        await database.posts.create_index([("createdAt", DESCENDING)])
        await database.posts.create_index([("authorId", ASCENDING), ("createdAt", DESCENDING)])
        await database.posts.create_index([("community", ASCENDING), ("createdAt", DESCENDING)])
        await database.posts.create_index([("hashtags", ASCENDING), ("createdAt", DESCENDING)])

        # Follows indexes
        await database.follows.create_index([("followerId", ASCENDING), ("followingId", ASCENDING)], unique=True)
        await database.follows.create_index([("followingId", ASCENDING)])

        # Whispers indexes (anonymity preservation)
        await database.whispers.create_index([("recipientHandle", ASCENDING), ("createdAt", DESCENDING)])
        await database.whispers.create_index([("recipientId", ASCENDING), ("createdAt", DESCENDING)])

        # Stories indexes with TTL automatic expiration (24 hours)
        await database.stories.create_index([("expiresAt", ASCENDING)], expireAfterSeconds=0)
        await database.stories.create_index([("authorId", ASCENDING), ("createdAt", DESCENDING)])

        logger.info("MongoDB indexes verified/created successfully.")
    except Exception as e:
        logger.error(f"Error creating database indexes: {e}")
