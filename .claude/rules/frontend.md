---
paths:
  - "frontend/**"
---

# Frontend (`frontend/src/app/`)

Angular 19, **standalone components + signals** (no NgModules). `app.config.ts`
provides `HttpClient` app-wide.

- `services/plant.service.ts` — the single source of truth. Holds the plant list
  in a signal and exposes derived signals (`totalPlants`, `plantsNeedingWater`,
  `loading`, `error`) that components reuse. All CRUD goes through here; it maps
  the backend `PlantDto` (ISO date string) to the `Plant` model (`Date` object).
- `models/watering.ts` — pure watering math. `wateringProgress()` returns 0–100
  from days-since-watered vs. `wateringFrequencyDays`; `needsWater()` is true at
  100. Reused by both the dashboard counts and the plant cards.
- `components/` — `plant-list` orchestrates the grid + modals; `plant-card`
  shows one plant + its watering progress; `add-plant-form` is the add/edit
  form; `dashboard` shows summary stats; `botanic-expert` is the AI chat panel.

## Conventions
- API base URL lives in `frontend/src/environments/`. Both `environment.ts` and
  `environment.development.ts` point at `http://localhost:8000`; update
  `environment.ts` before a production build.
- Keep the DTO ↔ model conversion (date string ↔ `Date`) inside `PlantService`,
  not in components.
