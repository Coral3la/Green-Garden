# Green Garden 🍃

Green Garden is a houseplant care tracker. Add the plants you own, and the app
keeps an eye on each one's watering schedule — showing how far through its
watering cycle it is and flagging the ones that are due. When you're unsure how
to care for a plant, you can consult a built-in AI "botanic expert" that gives
advice tailored to that specific plant.

## Features

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
- `HttpClient` for talking to the backend
- Karma + Jasmine for unit tests

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) on Uvicorn
- [MongoDB](https://www.mongodb.com/) via the async [Motor](https://motor.readthedocs.io/) driver
- Pydantic models + `pydantic-settings` for validation and configuration
- `httpx` to call the OpenAI API (for the botanic expert)

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
- The **backend** exposes a `/plants` CRUD API and a `/chat` endpoint. The chat
  endpoint builds the AI prompt server-side and proxies the request to OpenAI,
  so the secret key and prompt logic live in one place.

### Backend API

| Method   | Path             | Description                          |
| -------- | ---------------- | ------------------------------------ |
| `GET`    | `/plants`        | List all plants                      |
| `POST`   | `/plants`        | Create a plant                       |
| `GET`    | `/plants/{id}`   | Get a single plant                   |
| `PATCH`  | `/plants/{id}`   | Update one or more fields of a plant |
| `DELETE` | `/plants/{id}`   | Delete a plant                       |
| `POST`   | `/chat`          | Ask the botanic expert about a plant |

Interactive API docs are available at `http://localhost:8000/docs` once the
backend is running.

## Project Structure

```
Green-Garden/
├── backend/
│   ├── app/
│   │   ├── config.py            # Settings loaded from .env
│   │   ├── database.py          # MongoDB connection lifecycle
│   │   ├── models.py            # Pydantic plant models
│   │   └── routers/
│   │       ├── plants.py        # /plants CRUD endpoints
│   │       └── chat.py          # /chat botanic-expert endpoint
│   ├── main.py                  # FastAPI app, CORS, router wiring
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/app/
        ├── components/
        │   ├── dashboard/       # Summary stats
        │   ├── plant-list/      # Orchestrates the grid + modals
        │   ├── plant-card/      # A single plant + watering progress
        │   ├── add-plant-form/  # Add / edit plant form
        │   └── botanic-expert/  # AI chat panel
        ├── services/plant.service.ts   # Signal-based plant store + API calls
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

# Configure environment variables
cp .env.example .env            # then edit .env with your values
```

Edit `backend/.env`:

```
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@your-cluster.mongodb.net/
DATABASE_NAME=green_garden
OPENAI_API_KEY=sk-...           # optional; leave blank to disable AI chat
```

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

The app starts on `http://localhost:4200` and will hot-reload on changes.

### Running tests

```bash
cd frontend
npm test
```

## Development Notes

- **CORS** is configured in `backend/main.py` to allow the Angular dev server at
  `http://localhost:4200`. If you serve the frontend from a different origin,
  add it to the `origins` list.
- **API URL** is set per environment in
  `frontend/src/environments/`. `environment.development.ts` and
  `environment.ts` both point at `http://localhost:8000` — update
  `environment.ts` to your deployed backend URL before running `ng build` for
  production.
- **The AI chat is optional.** With no `OPENAI_API_KEY` set, the `/chat`
  endpoint returns a `503` with a clear message, and the rest of the app works
  normally.
- **Watering logic** lives in `frontend/src/app/models/watering.ts`.
  `wateringProgress()` returns a 0–100 value based on days since the last
  watering versus the plant's watering frequency, and `needsWater()` is true at
  100.
