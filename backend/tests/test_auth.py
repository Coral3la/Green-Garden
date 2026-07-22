import jwt
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.database import get_database
from app.security import create_access_token
from tests.test_plants import sample_plant


def credentials() -> dict:
    return {
        "email": "gardener@example.com",
        "password": "secret123",
        "display_name": "Gardener",
    }


async def test_register_returns_user_without_password_hash(client):
    resp = await client.post("/auth/register", json=credentials())
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "gardener@example.com"
    assert body["display_name"] == "Gardener"
    assert isinstance(body["id"], str)
    assert "hashed_password" not in body  # the hash must never leak


async def test_register_duplicate_email_returns_400(client):
    await client.post("/auth/register", json=credentials())
    resp = await client.post("/auth/register", json=credentials())
    assert resp.status_code == 400


async def test_register_losing_the_duplicate_race_returns_400(client, monkeypatch):
    # Two registrations for one email can both clear the find_one check; the
    # unique index rejects the loser. mongomock does not enforce indexes, so
    # simulate the insert that loses — it must read as 400, not 500.
    users = get_database()["users"]

    async def raise_duplicate(self, *args, **kwargs):
        raise DuplicateKeyError("email already registered")

    monkeypatch.setattr(type(users), "insert_one", raise_duplicate)
    resp = await client.post("/auth/register", json=credentials())
    assert resp.status_code == 400


async def test_register_short_password_returns_422(client):
    resp = await client.post("/auth/register", json=credentials() | {"password": "x"})
    assert resp.status_code == 422


async def test_register_overlong_password_returns_422(client):
    # bcrypt refuses more than 72 bytes, so the API has to reject it rather
    # than letting the hash raise into a 500.
    resp = await client.post(
        "/auth/register", json=credentials() | {"password": "a" * 73}
    )
    assert resp.status_code == 422


async def test_register_multibyte_password_over_72_bytes_returns_422(client):
    # 40 characters but 160 bytes — the limit is on bytes, which is exactly
    # what a character-counting max_length would have missed.
    resp = await client.post(
        "/auth/register", json=credentials() | {"password": "🌱" * 40}
    )
    assert resp.status_code == 422


async def test_login_overlong_password_returns_401(client):
    # Login parses an OAuth2 form, so UserCreate never sees this password. It
    # cannot match any stored hash, so it is a bad credential, not a crash.
    await client.post("/auth/register", json=credentials())
    resp = await client.post(
        "/auth/login",
        data={"username": "gardener@example.com", "password": "a" * 100},
    )
    assert resp.status_code == 401


async def test_login_then_me_roundtrip(client):
    await client.post("/auth/register", json=credentials())
    # OAuth2PasswordRequestForm reads form-encoded username/password.
    login = await client.post(
        "/auth/login",
        data={"username": "gardener@example.com", "password": "secret123"},
    )
    assert login.status_code == 200
    body = login.json()
    assert body["token_type"] == "bearer"

    me = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "gardener@example.com"


async def test_login_wrong_password_returns_401(client):
    await client.post("/auth/register", json=credentials())
    resp = await client.post(
        "/auth/login",
        data={"username": "gardener@example.com", "password": "wrong-password"},
    )
    assert resp.status_code == 401


async def test_token_carries_issued_at_so_the_client_can_time_renewal(client):
    token = create_access_token("507f1f77bcf86cd799439011")
    claims = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    assert claims["iat"] < claims["exp"]


async def test_refresh_returns_a_usable_token(client, auth_headers):
    resp = await client.post("/auth/refresh", headers=auth_headers)
    assert resp.status_code == 200

    renewed = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    me = await client.get("/auth/me", headers=renewed)
    assert me.status_code == 200
    assert me.json()["email"] == "gardener@example.com"


async def test_refresh_without_a_token_returns_401(client):
    assert (await client.post("/auth/refresh")).status_code == 401


async def test_password_change_lets_the_new_password_log_in(client, auth_headers):
    resp = await client.patch(
        "/auth/password",
        json={"current_password": "secret123", "new_password": "brand-new-1"},
        headers=auth_headers,
    )
    assert resp.status_code == 204

    old = await client.post(
        "/auth/login",
        data={"username": "gardener@example.com", "password": "secret123"},
    )
    assert old.status_code == 401
    new = await client.post(
        "/auth/login",
        data={"username": "gardener@example.com", "password": "brand-new-1"},
    )
    assert new.status_code == 200


async def test_password_change_with_wrong_current_password_returns_401(
    client, auth_headers
):
    resp = await client.patch(
        "/auth/password",
        json={"current_password": "not-it", "new_password": "brand-new-1"},
        headers=auth_headers,
    )
    assert resp.status_code == 401

    # The old password must still work — a failed attempt changes nothing.
    login = await client.post(
        "/auth/login",
        data={"username": "gardener@example.com", "password": "secret123"},
    )
    assert login.status_code == 200


async def test_password_change_without_a_token_returns_401(client):
    resp = await client.patch(
        "/auth/password",
        json={"current_password": "secret123", "new_password": "brand-new-1"},
    )
    assert resp.status_code == 401


async def test_password_change_rejects_a_short_new_password(client, auth_headers):
    resp = await client.patch(
        "/auth/password",
        json={"current_password": "secret123", "new_password": "x"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_password_change_rejects_an_overlong_new_password(client, auth_headers):
    # Same bcrypt ceiling as registration — both go through `Password`.
    resp = await client.patch(
        "/auth/password",
        json={"current_password": "secret123", "new_password": "a" * 73},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_token_with_malformed_sub_returns_401(client):
    # Correctly signed, but `sub` is not an ObjectId — a bad credential, so it
    # must come back 401 rather than blowing up on the ObjectId conversion.
    token = create_access_token("not-a-valid-oid")
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


async def test_list_without_token_returns_401(client):
    assert (await client.get("/plants")).status_code == 401


async def test_create_without_token_returns_401(client):
    resp = await client.post("/plants", json=sample_plant())
    assert resp.status_code == 401


async def test_plants_are_scoped_per_user(client, auth_headers, register_user):
    created = (
        await client.post("/plants", json=sample_plant(), headers=auth_headers)
    ).json()
    pid = created["id"]

    other = await register_user("intruder@example.com")
    # The second user sees an empty garden...
    assert (await client.get("/plants", headers=other)).json() == []
    # ...and cannot read, modify, or delete the first user's plant.
    assert (await client.get(f"/plants/{pid}", headers=other)).status_code == 404
    assert (
        await client.patch(f"/plants/{pid}", json={"location": "X"}, headers=other)
    ).status_code == 404
    assert (await client.delete(f"/plants/{pid}", headers=other)).status_code == 404
