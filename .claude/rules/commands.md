# Commands

## Backend (run from `backend/`, virtualenv activated)
```bash
python -m venv venv && source venv/bin/activate   # first time
pip install -r requirements.txt                   # runtime deps
pip install -r requirements-dev.txt               # + ruff, pytest, mongomock
uvicorn main:app --reload                          # run on :8000

pytest                                             # run the test suite
pytest tests/test_plants.py                        # one file
pytest tests/test_plants.py::test_delete_removes_plant  # one test
ruff check .                                        # lint
ruff format .                                       # format
```
Requires `backend/.env` (copy `.env.example`). Interactive API docs at
`http://localhost:8000/docs`. Tests use an in-memory Mongo (mongomock-motor) and
need no real database or network — see `tests/conftest.py`.

## Frontend (run from `frontend/`)
```bash
npm install        # install deps
npm start          # ng serve on :4200, hot reload
npm run build      # production build
npm test           # Karma + Jasmine, watch mode in Chrome
npm run lint       # ESLint (angular-eslint, flat config in eslint.config.js)
npm run format     # Prettier --write across the project
npm run format:check   # Prettier in check mode — what CI runs
```

ESLint says nothing about formatting, so `npm run lint` passing does **not**
mean the tree is formatted. Run `npm run format` before committing.

To run a **single test**, temporarily use Jasmine's `fdescribe`/`fit` focus
helpers in the relevant `.spec.ts`, or narrow the files Karma loads via the
`test` glob in `frontend/tsconfig.spec.json`. There is no built-in `--grep`.
For a non-interactive single run: `npm test -- --watch=false --browsers=ChromeHeadless`.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every PR: ruff
(check + format) and pytest for the backend, ESLint + Prettier + Karma + build
for the frontend. It needs no secrets — the backend suite fills in its own
settings and runs on mongomock.
