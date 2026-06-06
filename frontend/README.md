# 🌱 Green Garden

A simple plant-care tracker built with Angular. Add your houseplants, log when you water them, and see at a glance which ones are thirsty.

## Features

- **Plant collection** — add plants with a name, image, and watering frequency.
- **Watering reminders** — dashboard highlights how many plants currently need water based on each plant's schedule.
- **One-click watering** — mark a plant as watered to reset its timer.
- **Local persistence** — your garden is saved to `localStorage`, so it survives page reloads.
- **Reactive state** — built on Angular signals (`signal`, `computed`, `effect`).

## Tech Stack

- [Angular 19](https://angular.dev/) (standalone components + signals)
- TypeScript 5.7
- RxJS 7.8
- Karma + Jasmine for unit tests

## Project Structure

```
src/app/
├── components/
│   ├── add-plant-form/   # form to add a new plant
│   ├── dashboard/        # summary view (totals, plants needing water)
│   ├── plant-card/       # individual plant tile with water/remove actions
│   └── plant-list/       # grid of plant cards
├── models/
│   └── plant.model.ts    # Plant interface
└── services/
    └── plant.service.ts  # signal-based plant state + localStorage
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Run locally

```bash
npm start
```

Then open [http://localhost:4200](http://localhost:4200). The app reloads on file changes.

### Build for production

```bash
npm run build
```

Build artifacts are written to `dist/`.

### Run unit tests

```bash
npm test
```

## How it works

Plants are stored as a signal in [`PlantService`](src/app/services/plant.service.ts). A `computed` signal counts how many plants are overdue based on `lastWateredAt` and `wateringFrequencyDays`, and an `effect` mirrors every change into `localStorage` under the key `green-garden-plants`. On first load the app seeds a few starter plants (Aloe Vera, Monstera, Cactus).

## License

MIT
