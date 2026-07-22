import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app import database
from app.rate_limit import FailureLimiter, login_limiter
from main import app
from tests.test_auth import credentials

# Every wrong password costs a real bcrypt verification (~250ms), so these
# tests turn the limit down rather than spending ten of them per assertion.
# What is under test is the behaviour, not the specific number.
TEST_LIMIT = 3


@pytest.fixture(autouse=True)
def low_limit():
    original = login_limiter.max_failures
    login_limiter.max_failures = TEST_LIMIT
    yield
    login_limiter.max_failures = original


def wrong_password() -> dict:
    return {"username": "gardener@example.com", "password": "not-the-password"}


def right_password() -> dict:
    return {"username": "gardener@example.com", "password": "secret123"}


@pytest_asyncio.fixture
async def client_from():
    """Factory for clients that appear to come from a given IP address.

    The default `client` fixture always looks like one caller; throttling is
    per-address, so these tests need to be able to be somebody else.
    """
    mock_client = AsyncMongoMockClient()
    database.mongo.client = mock_client
    database.mongo.database = mock_client[os.environ["DATABASE_NAME"]]
    login_limiter.clear()
    opened: list[AsyncClient] = []

    def _from(ip: str) -> AsyncClient:
        transport = ASGITransport(app=app, client=(ip, 12345))
        ac = AsyncClient(transport=transport, base_url="http://test")
        opened.append(ac)
        return ac

    yield _from

    for ac in opened:
        await ac.aclose()
    database.mongo.client = None
    database.mongo.database = None
    login_limiter.clear()


async def test_repeated_failures_are_eventually_refused(client):
    await client.post("/auth/register", json=credentials())

    for _ in range(TEST_LIMIT):
        resp = await client.post("/auth/login", data=wrong_password())
        assert resp.status_code == 401

    refused = await client.post("/auth/login", data=wrong_password())
    assert refused.status_code == 429
    assert refused.headers["Retry-After"]


async def test_throttling_outlasts_a_correct_password(client):
    # The point of the limit: once spent, guessing right is no longer a way in
    # until the window passes. Otherwise a guesser simply keeps going.
    await client.post("/auth/register", json=credentials())
    for _ in range(TEST_LIMIT):
        await client.post("/auth/login", data=wrong_password())

    assert (await client.post("/auth/login", data=right_password())).status_code == 429


async def test_signing_in_successfully_clears_the_record(client):
    await client.post("/auth/register", json=credentials())
    for _ in range(TEST_LIMIT - 1):
        await client.post("/auth/login", data=wrong_password())

    # One success wipes the slate, so a user who fumbles and then remembers is
    # not left one mistake away from being locked out.
    assert (await client.post("/auth/login", data=right_password())).status_code == 200
    for _ in range(TEST_LIMIT - 1):
        resp = await client.post("/auth/login", data=wrong_password())
        assert resp.status_code == 401


async def test_one_caller_cannot_lock_out_another(client_from):
    attacker = client_from("10.0.0.1")
    victim = client_from("10.0.0.2")
    await attacker.post("/auth/register", json=credentials())

    for _ in range(TEST_LIMIT + 2):
        await attacker.post("/auth/login", data=wrong_password())
    blocked = await attacker.post("/auth/login", data=right_password())
    assert blocked.status_code == 429

    # The real owner, from their own address, is unaffected.
    assert (await victim.post("/auth/login", data=right_password())).status_code == 200


def test_attempts_outside_the_window_are_forgotten():
    # Unit-level, so the window can be short enough to actually elapse.
    limiter = FailureLimiter(max_failures=2, window_seconds=0)
    limiter.record_failure("caller")
    limiter.record_failure("caller")
    # Nothing raised: both failures have already aged out of a zero-length
    # window, which is what an expired window looks like.
    limiter.check("caller")


def test_counters_do_not_accumulate_for_callers_who_age_out():
    limiter = FailureLimiter(max_failures=2, window_seconds=0)
    limiter.record_failure("caller")
    limiter.check("caller")
    assert limiter._failures == {}
