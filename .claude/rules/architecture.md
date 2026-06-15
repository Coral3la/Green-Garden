# Architecture

Two independently-runnable apps:

```
Angular app (port 4200) ──HTTP──> FastAPI backend (port 8000) ──> MongoDB
                                          │
                                          └──> OpenAI API (botanic-expert chat)
```

The frontend never talks to MongoDB or OpenAI directly — all data and the AI
prompt go through the backend, so the OpenAI key and prompt logic stay
server-side. On the frontend, `PlantService` is the single source of truth
(signal-based store); `models/watering.ts` holds the shared pure watering math.
See the `backend/` and `frontend/` rules for module-level detail.

## ⚠️ Auth migration is mid-flight
The JWT backend (`auth` router: `/auth/register`, `/auth/login`, `/auth/me`,
bcrypt + `get_current_user`) exists, but it is **not yet enforced**:
- `/plants` and `/chat` do **not** depend on `get_current_user`, and plant
  documents have **no owner field** — plants are global, not per-user.
- The frontend has **no auth wiring** — no token storage, no HTTP interceptor,
  no login UI. `PlantService` sends requests without an `Authorization` header.

Completing "multi-user gardens" means scoping plants to a user on the backend
*and* adding login + token-attaching on the frontend. `README.md` predates this
work and describes the pre-auth app.
