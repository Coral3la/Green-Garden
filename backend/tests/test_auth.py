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
