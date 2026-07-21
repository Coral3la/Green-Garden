def sample_plant() -> dict:
    return {
        "name": "Monstera",
        "imgUrl": "http://example.com/monstera.jpg",
        "location": "Living room",
        "wateringFrequencyDays": 7,
    }


async def test_create_returns_201_with_string_id(client, auth_headers):
    resp = await client.post("/plants", json=sample_plant(), headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Monstera"
    assert isinstance(body["id"], str)
    assert "lastWateredAt" in body  # defaulted server-side
    assert "owner_id" not in body  # owner is server-managed, never exposed


async def test_create_then_list(client, auth_headers):
    created = (
        await client.post("/plants", json=sample_plant(), headers=auth_headers)
    ).json()
    resp = await client.get("/plants", headers=auth_headers)
    assert resp.status_code == 200
    plants = resp.json()
    assert len(plants) == 1
    assert plants[0]["id"] == created["id"]


async def test_get_single_plant(client, auth_headers):
    created = (
        await client.post("/plants", json=sample_plant(), headers=auth_headers)
    ).json()
    resp = await client.get(f"/plants/{created['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


async def test_get_nonexistent_id_returns_404(client, auth_headers):
    resp = await client.get("/plants/507f1f77bcf86cd799439011", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_malformed_id_returns_404(client, auth_headers):
    resp = await client.get("/plants/not-a-valid-objectid", headers=auth_headers)
    assert resp.status_code == 404


async def test_create_with_nonpositive_frequency_returns_422(client, auth_headers):
    bad = sample_plant() | {"wateringFrequencyDays": 0}
    resp = await client.post("/plants", json=bad, headers=auth_headers)
    assert resp.status_code == 422


async def test_patch_updates_a_field(client, auth_headers):
    created = (
        await client.post("/plants", json=sample_plant(), headers=auth_headers)
    ).json()
    resp = await client.patch(
        f"/plants/{created['id']}", json={"location": "Balcony"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["location"] == "Balcony"


async def test_patch_with_no_fields_returns_400(client, auth_headers):
    created = (
        await client.post("/plants", json=sample_plant(), headers=auth_headers)
    ).json()
    resp = await client.patch(f"/plants/{created['id']}", json={}, headers=auth_headers)
    assert resp.status_code == 400


async def test_delete_removes_plant(client, auth_headers):
    created = (
        await client.post("/plants", json=sample_plant(), headers=auth_headers)
    ).json()
    resp = await client.delete(f"/plants/{created['id']}", headers=auth_headers)
    assert resp.status_code == 204
    assert (
        await client.get(f"/plants/{created['id']}", headers=auth_headers)
    ).status_code == 404
