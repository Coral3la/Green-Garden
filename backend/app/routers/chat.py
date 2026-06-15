import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/chat", tags=["chat"])

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"


# ---- The shape of what the frontend sends us -----------------------------
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class PlantContext(BaseModel):
    name: str
    location: str
    lastWateredAt: str


class ChatRequest(BaseModel):
    plant: PlantContext
    messages: list[ChatMessage]


# ---- The shape of what we send back --------------------------------------
class ChatResponse(BaseModel):
    reply: str


def build_system_prompt(plant: PlantContext) -> str:
    """Same prompt the frontend used to build — now it lives on the server."""
    return (
        f"You are an expert indoor plant agronomist. The user is growing a "
        f"{plant.name} located in {plant.location}, and it was last watered on "
        f"{plant.lastWateredAt}. Answer the user's question short, professionally, "
        f"and encouragingly. Break down your advice into clear, practical, "
        f"actionable steps."
    )


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # 1. Refuse early (with a clear message) if no key is configured.
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI chat is not configured. "
                "Set OPENAI_API_KEY in the backend .env file."
            ),
        )

    # 2. Build the request for OpenAI: system prompt first, then the conversation.
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": build_system_prompt(request.plant)},
            *[m.model_dump() for m in request.messages],
        ],
        "temperature": 0.7,
    }
    # The secret key lives here, on the server — it never reaches the browser.
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}

    # 3. Call OpenAI, and translate any failure into a clean error for the frontend.
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(OPENAI_URL, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # OpenAI answered, but with an error (bad key, no credit, rate limit...).
        raise HTTPException(
            status_code=502, detail="The AI service returned an error."
        ) from exc
    except httpx.HTTPError as exc:
        # Couldn't even reach OpenAI (network/timeout).
        raise HTTPException(
            status_code=502, detail="Could not reach the AI service."
        ) from exc

    # 4. Pull the assistant's text out of OpenAI's response and return it.
    data = response.json()
    reply = data["choices"][0]["message"]["content"].strip()
    return ChatResponse(reply=reply)
