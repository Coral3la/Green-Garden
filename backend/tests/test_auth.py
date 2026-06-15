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


async def test_register_short_password_returns_422(client):
    resp = await client.post("/auth/register", json=credentials() | {"password": "x"})
    assert resp.status_code == 422


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


async def test_me_without_token_returns_401(client):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401
