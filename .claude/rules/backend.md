---
paths:
  - "backend/**"
---

# Backend (`backend/app/`)

FastAPI + async Motor (MongoDB) + pydantic-settings.

- `main.py` (at `backend/`, **not** in `app/`) — creates the app, wires the
  three routers (`plants`, `chat`, `auth`), sets up CORS, and manages the Mongo
  connection via a `lifespan` context manager.
- `database.py` — Mongo connection lifecycle; `get_database()` is the accessor
  every router uses.
- `config.py` — `Settings` loaded from `.env`. `mongo_uri` and `jwt_secret_key`
  are **required** (the app won't start without them).
- `routers/plants.py` — `/plants` CRUD.
- `routers/chat.py` — `/chat` builds the system prompt server-side and proxies
  to OpenAI (`gpt-4o-mini`).
- `routers/auth.py` + `security.py` + `auth_models.py` — JWT auth (see the auth
  section of the architecture rule for what is enforced where).
- `rate_limit.py` — in-process failure throttling for `/auth/login`. Global
  state, so `tests/conftest.py` clears it between tests.

## Conventions
- Mongo `_id` is serialized to a string `id` field at the serialization boundary
  in each router (`serialize_plant` / `serialize_user`). Keep API responses
  using string `id`, never a raw `ObjectId`. `to_object_id` turns a malformed id
  into a 404.
- `/chat` returns **503** if `OPENAI_API_KEY` is unset and **502** on any
  OpenAI failure, so the rest of the app keeps working without a key.
- CORS allowed origins are hardcoded in `main.py` (`localhost:4200` only). Add
  any new frontend origin there.
