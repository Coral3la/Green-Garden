# Green Garden 🍃

Green Garden is a houseplant care tracker. Create an account, add the plants you
own, and the app keeps an eye on each one's watering schedule — showing how far
through its watering cycle it is and flagging the ones that are due. When you're
unsure how to care for a plant, you can consult a built-in AI "botanic expert"
that gives advice tailored to that specific plant.

Every garden is private: plants belong to the account that created them, and the
API will not return them to anyone else.

## Features

- **Private gardens** — register with an email and password; your plants are
  yours alone, and the API rejects unauthenticated requests.
- **Track your plants** — add, edit, and remove plants, each with a name, photo,
  location, and watering frequency.
- **Watering at a glance** — every plant card shows a progress bar for its
  watering cycle and highlights plants that are due (or overdue) for water.
- **One-tap watering** — mark a plant as watered and its cycle resets.
- **Dashboard summary** — see the total number of plants and how many currently
  need water.
- **Ask the botanic expert** — an optional AI chat that answers plant-care
  questions with context about the specific plant (its name, location, and when
  it was last watered).

## Tech Stack

**Frontend**
- [Angular 19](https://angular.dev/) (standalone components, signals)
- Reactive & template-driven forms
- `HttpClient` + an auth interceptor for talking to the backend
- Karma + Jasmine for unit tests, ESLint + Prettier for lint and formatting

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) on Uvicorn
- [MongoDB](https://www.mongodb.com/) via the async [Motor](https://motor.readthedocs.io/) driver
- JWT auth with `pyjwt`, password hashing with `bcrypt`
- Pydantic models + `pydantic-settings` for validation and configuration
- `httpx` to call the OpenAI API (for the botanic expert)
- pytest for tests, Ruff for lint and formatting

## Architecture

The project is split into two independently runnable apps:

```
Angular app (port 4200) ──HTTP──> FastAPI backend (port 8000) ──> MongoDB
                                          │
                                          └──> OpenAI API (botanic expert)
```

- The **frontend** never talks to MongoDB or OpenAI directly. All data goes
  through the backend's REST API, and the OpenAI key stays on the server — it
  never reaches the browser.
- `PlantService` is the single source of truth on the frontend. It holds the
  plant list in a signal and exposes derived signals (`totalPlants`,
  `plantsNeedingWater`) that the dashboard and list reuse.
- The **backend** exposes a `/plants` CRUD API, a `/chat` endpoint, and an
  `/auth` router. The chat endpoint builds the AI prompt server-side and proxies
  the request to OpenAI, so the secret key and prompt logic live in one place.

### How auth works

1. `POST /auth/register` creates a user with a bcrypt-hashed password;
   `POST /auth/login` returns a signed JWT (valid for 60 minutes by default).
2. The frontend stores that token and `AuthService` exposes an `isLoggedIn`
   signal. An HTTP interceptor attaches `Authorization: Bearer <token>` to every
   outgoing request.
3. Each plant document carries an `owner_id`. Every `/plants` query is filtered
   by the caller's id, so another account's plant returns `404` rather than
   revealing that it exists. `owner_id` is server-managed and never appears in
   API responses.
4. If a token is missing or expired the backend returns `401`, and the
   interceptor clears the session and sends you back to the login screen.

### Backend API

Everything except register and login requires an `Authorization: Bearer <token>`
header.

| Method   | Path             | Auth | Description                          |
| -------- | ---------------- | ---- | ------------------------------------ |
| `POST`   | `/auth/register` | —    | Create an account                    |
| `POST`   | `/auth/login`    | —    | Exchange credentials for a JWT       |
| `POST`   | `/auth/refresh`  | ✓    | Trade a valid token for a fresh one  |
| `PATCH`  | `/auth/password` | ✓    | Change password (needs the current)  |
| `GET`    | `/auth/me`       | ✓    | Get the signed-in user's profile     |
| `GET`    | `/plants`        | ✓    | List your plants                     |
| `POST`   | `/plants`        | ✓    | Create a plant                       |
| `GET`    | `/plants/{id}`   | ✓    | Get a single plant                   |
| `PATCH`  | `/plants/{id}`   | ✓    | Update one or more fields of a plant |
| `DELETE` | `/plants/{id}`   | ✓    | Delete a plant                       |
| `POST`   | `/chat`          | ✓    | Ask the botanic expert about a plant |

`/auth/login` takes an OAuth2 password form (`username` + `password`, where
`username` is the email), not JSON. Every other endpoint takes JSON.

Interactive API docs are available at `http://localhost:8000/docs` once the
backend is running — use the **Authorize** button there to try protected routes.

## Project Structure

```
Green-Garden/
├── backend/
│   ├── app/
│   │   ├── config.py            # Settings loaded from .env
│   │   ├── database.py          # MongoDB connection lifecycle + indexes
│   │   ├── models.py            # Pydantic plant models
│   │   ├── auth_models.py       # Pydantic user + token models
│   │   ├── security.py          # Hashing, JWTs, get_current_user
│   │   ├── rate_limit.py        # Failed-login throttling
│   │   └── routers/
│   │       ├── plants.py        # /plants CRUD endpoints (owner-scoped)
│   │       ├── chat.py          # /chat botanic-expert endpoint
│   │       └── auth.py          # /auth register, login, me
│   ├── tests/                   # pytest suite (in-memory MongoDB)
│   ├── main.py                  # FastAPI app, CORS, router wiring
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── .env.example
└── frontend/
    └── src/app/
        ├── components/
        │   ├── auth-form/       # Sign in / register
        │   ├── change-password/ # Change password (needs the current one)
        │   ├── dashboard/       # Summary stats
        │   ├── plant-list/      # Orchestrates the grid + modals
        │   ├── plant-card/      # A single plant + watering progress
        │   ├── add-plant-form/  # Add / edit plant form
        │   └── botanic-expert/  # AI chat panel
        ├── interceptors/
        │   └── auth.interceptor.ts    # Attaches the bearer token, handles 401
        ├── services/
        │   ├── plant.service.ts       # Signal-based plant store + API calls
        │   └── auth.service.ts        # Token + current-user store
        └── models/
            ├── plant.model.ts
            └── watering.ts      # Watering-progress calculations
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- [Python](https://www.python.org/) 3.11+
- A MongoDB connection string (a free [MongoDB Atlas](https://www.mongodb.com/atlas)
  cluster works well)
- *(Optional)* An [OpenAI API key](https://platform.openai.com/api-keys) — only
  needed for the botanic expert chat

### Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt   # optional: ruff, pytest, mongomock

# Configure environment variables
cp .env.example .env            # then edit .env with your values
```

Edit `backend/.env`:

```
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@your-cluster.mongodb.net/
DATABASE_NAME=green_garden
JWT_SECRET_KEY=a-long-random-string
OPENAI_API_KEY=sk-...           # optional; leave blank to disable AI chat
```

`MONGO_URI` and `JWT_SECRET_KEY` are **required** — the app refuses to start
without them. Generate a secret with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Changing `JWT_SECRET_KEY` invalidates every token that was already issued, so
everyone has to sign in again.

### Frontend setup

```bash
cd frontend
npm install
```

## Running the App

Run the two apps in separate terminals.

**Backend** (from `backend/`, with the virtualenv activated):

```bash
uvicorn main:app --reload
```

The API starts on `http://localhost:8000`. You should see `✅ Connected to
MongoDB` in the logs once it connects.

**Frontend** (from `frontend/`):

```bash
npm start
```

The app starts on `http://localhost:4200` and will hot-reload on changes. You'll
land on the sign-in screen — create an account to get to your garden.

### Running tests

Backend (from `backend/`, virtualenv activated):

```bash
pytest                      # whole suite
pytest tests/test_plants.py # one file
ruff check .                # lint
ruff format .               # format
```

The backend tests use an in-memory MongoDB (`mongomock-motor`), so they need no
real database and no network.

Frontend (from `frontend/`):

```bash
npm test                    # Karma + Jasmine, watch mode
npm run lint                # ESLint
npm run format              # Prettier --write
```

For a single non-interactive run: `npm test -- --watch=false --browsers=ChromeHeadless`.

## Development Notes

- **CORS** is configured in `backend/main.py` to allow the Angular dev server at
  `http://localhost:4200`. If you serve the frontend from a different origin,
  add it to the `origins` list.
- **API URL** is set per environment in
  `frontend/src/environments/`. `environment.development.ts` and
  `environment.ts` both point at `http://localhost:8000` — update
  `environment.ts` to your deployed backend URL before running `ng build` for
  production.
- **Tokens are kept in `localStorage`** under `green-garden.token` and expire
  after `ACCESS_TOKEN_EXPIRE_MINUTES` (60 by default). On startup the app
  validates a stored token against `/auth/me` rather than trusting it.
- **Sessions renew as you use them.** Once a token is past halfway through its
  life, the next request swaps it for a fresh one via `/auth/refresh`, so an
  active session never lapses mid-task. An idle one still expires — nothing
  renews without traffic.
- **Sign-in is throttled.** Ten failed attempts from one address within five
  minutes returns `429` with a `Retry-After` header. Only failures count and a
  successful sign-in clears the record. The counters live in memory, so they
  reset when the backend restarts.
- **The AI chat is optional.** With no `OPENAI_API_KEY` set, the `/chat`
  endpoint returns a `503` with a clear message, and the rest of the app works
  normally.
- **Watering logic** lives in `frontend/src/app/models/watering.ts`.
  `wateringProgress()` returns a 0–100 value based on days since the last
  watering versus the plant's watering frequency, and `needsWater()` is true at
  100.
