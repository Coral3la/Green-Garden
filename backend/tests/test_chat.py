import httpx

from app.routers import chat

CHAT_PAYLOAD = {
    "plant": {"name": "Fern", "location": "Bathroom", "lastWateredAt": "2026-06-01"},
    "messages": [{"role": "user", "content": "How often should I water this?"}],
}


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict:
        return self._payload


def _fake_client_factory(post):
    """Build a drop-in replacement for httpx.AsyncClient with a custom post()."""

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            return await post(*args, **kwargs)

    return _FakeAsyncClient


async def test_chat_without_token_returns_401(client):
    resp = await client.post("/chat", json=CHAT_PAYLOAD)
    assert resp.status_code == 401


async def test_chat_without_api_key_returns_503(client, auth_headers, monkeypatch):
    monkeypatch.setattr(chat.settings, "openai_api_key", "")
    resp = await client.post("/chat", json=CHAT_PAYLOAD, headers=auth_headers)
    assert resp.status_code == 503


async def test_chat_success_returns_reply(client, auth_headers, monkeypatch):
    monkeypatch.setattr(chat.settings, "openai_api_key", "sk-test")

    async def fake_post(*args, **kwargs):
        return _FakeResponse(
            {"choices": [{"message": {"content": "  Water it weekly.  "}}]}
        )

    monkeypatch.setattr(chat.httpx, "AsyncClient", _fake_client_factory(fake_post))
    resp = await client.post("/chat", json=CHAT_PAYLOAD, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["reply"] == "Water it weekly."  # trimmed by the endpoint


async def test_chat_upstream_failure_returns_502(client, auth_headers, monkeypatch):
    monkeypatch.setattr(chat.settings, "openai_api_key", "sk-test")

    async def fake_post(*args, **kwargs):
        raise httpx.ConnectError("network down")

    monkeypatch.setattr(chat.httpx, "AsyncClient", _fake_client_factory(fake_post))
    resp = await client.post("/chat", json=CHAT_PAYLOAD, headers=auth_headers)
    assert resp.status_code == 502
