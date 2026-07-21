from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings


class MongoDB:
    client: AsyncIOMotorClient | None = None
    database: AsyncIOMotorDatabase | None = None


mongo = MongoDB()


async def connect_to_mongo() -> None:
    mongo.client = AsyncIOMotorClient(settings.mongo_uri)
    mongo.database = mongo.client[settings.database_name]
    await mongo.client.admin.command("ping")
    await mongo.database["users"].create_index("email", unique=True)
    await mongo.database["plants"].create_index("owner_id")
    print("✅ Connected to MongoDB")


async def close_mongo_connection() -> None:
    if mongo.client is not None:
        mongo.client.close()
        print("👋 Closed MongoDB connection")


def get_database() -> AsyncIOMotorDatabase:
    if mongo.database is None:
        raise RuntimeError("Database not initialized — did the app start correctly?")
    return mongo.database
