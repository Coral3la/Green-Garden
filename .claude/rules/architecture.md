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

## Auth: enforced end-to-end

Gardens are per-user. JWT auth (`auth` router: `/auth/register`, `/auth/login`,
`/auth/me`, bcrypt + `get_current_user`) is **enforced on every route except
register and login**.

Backend:
- All five `/plants` endpoints and `/chat` depend on `get_current_user`.
- Plant documents carry an `owner_id`. Every read/update/delete filters on it,
  so another user's plant returns **404, not 403** — deliberately, so the API
  never confirms that an id exists. Keep new plant queries owner-scoped.
- `owner_id` is server-managed: set on create, stripped in `serialize_plant`,
  never accepted from or returned to the client.
- `/auth/login` takes an **OAuth2 password form** (`username` = the email), not
  JSON like every other endpoint.
- `/auth/refresh` trades a still-valid token for a fresh one (sliding renewal).
  Tokens carry `iat` as well as `exp` so the client can tell when one is
  halfway through its life without knowing the configured lifetime.
- `/auth/password` changes a password and **requires the current one** — a
  stolen token alone must not lock the owner out. Both stored-password fields
  use the shared `Password` type in `auth_models.py`, which carries the
  min-length and the bcrypt 72-**byte** ceiling in one place.
- `/auth/login` is throttled by `app/rate_limit.py`: 10 failures per source
  address per 5 minutes, then 429. Only *failures* count and a success clears
  the record, so a legitimate user is never throttled. Keyed on IP rather than
  email deliberately — keying on email would let anyone lock a known user out.

Frontend:
- `services/auth.service.ts` — signal store (`token`, `isLoggedIn`, `user`),
  token in `localStorage` under `green-garden.token`. On startup a stored token
  is validated against `/auth/me` rather than trusted, with `restoring` true for
  the duration. The profile fetch is deferred a microtask so the interceptor
  can `inject()` this service without tripping NG0200.
- **`isLoggedIn` means "we hold a token"; `sessionReady` means "and we have
  vetted it".** The signed-in half of the app keys off `sessionReady` — acting
  on an unvetted token flashes the garden before bouncing the user to the login
  form. Only the auth form keys off `!isLoggedIn()`, so mid-restore neither
  view shows.
- `interceptors/auth.interceptor.ts` — attaches `Authorization: Bearer …`,
  drives sliding renewal, and clears the session on a 401. The 401 rule has one
  exception list, `CREDENTIAL_CHECKS` (`/auth/login`, `/auth/password`): a 401
  from an endpoint checking credentials the user *just typed* is that form's
  error to show, so a mistyped password does not end the session. Any other 401
  means our token is bad. **Add credential-checking endpoints to that list.**
- Renewal rides on ordinary traffic: any non-`/auth/` request with a token past
  halfway triggers `renewIfStale()`. So an active user is never dropped, an
  idle one still lapses. `decodeClaims` reads the JWT payload **without
  verifying it** — only ever to time renewal, never to make an auth decision.
- `PlantService` loads through a single `switchMap` keyed on `sessionReady` —
  never eagerly in the constructor, or it fires an unauthenticated request on
  boot. The `switchMap` is load-bearing: signing out must *cancel* the request
  in flight, or its response repopulates the list after the clear and the next
  user sees the previous one's garden. `loadPlants()` (the retry button) feeds
  the same pipeline so it cannot race itself.
- `app.component` switches on these signals: auth form in the hero when signed
  out, dashboard + plant list when the session is ready. **There is no router**
  in this app; a second view should reuse this signal-switch unless routing
  earns its keep.

## Known gaps

- **No password reset.** Changing a password requires knowing the current one,
  so a forgotten password is unrecoverable without direct database access. A
  reset flow needs email delivery, which this project has no infrastructure for.
- **Changing a password does not invalidate existing tokens.** JWTs are
  stateless with no `jti` or revocation list, so a token issued before the
  change keeps working until it expires (≤60 min).
- Renewal is driven by traffic, so a user idle past `exp` is still returned to
  the login screen — by design, but there is no warning before it happens.
- Login throttling (`app/rate_limit.py`) counts failures **in process**, so it
  resets on restart and does not coordinate across workers. Fine for one
  uvicorn process; a multi-worker deployment needs a shared store.
