import os

# config.py instantiates Settings() at import time, so the required settings must
# exist before the app is imported. setdefault leaves any real env vars untouched.
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
os.environ.setdefault("DATABASE_NAME", "green_garden_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-padded-to-32+-bytes")
os.environ.setdefault("OPENAI_API_KEY", "")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app import database
from app.rate_limit import login_limiter
from main import app


@pytest_asyncio.fixture
async def client():
    """An HTTP client wired to the app, backed by a fresh in-memory Mongo.

    ASGITransport does not run the app's lifespan, so the real `connect_to_mongo`
    never fires — we swap in a mongomock database instead. A new one per test
    keeps tests isolated.
    """
    mock_client = AsyncMongoMockClient()
    database.mongo.client = mock_client
    database.mongo.database = mock_client[os.environ["DATABASE_NAME"]]
    # The login limiter is module-level state that would otherwise carry failed
    # attempts from one test into the next.
    login_limiter.clear()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    database.mongo.client = None
    database.mongo.database = None
    login_limiter.clear()


@pytest_asyncio.fixture
def register_user(client):
    """Factory: register + login a user, return their Bearer auth headers."""

    async def _register(email: str = "gardener@example.com") -> dict:
        await client.post(
            "/auth/register",
            json={
                "email": email,
                "password": "secret123",
                "display_name": "Gardener",
            },
        )
        login = await client.post(
            "/auth/login", data={"username": email, "password": "secret123"}
        )
        return {"Authorization": f"Bearer {login.json()['access_token']}"}

    return _register


@pytest_asyncio.fixture
async def auth_headers(register_user):
    """Auth headers for a single default user."""
    return await register_user()
