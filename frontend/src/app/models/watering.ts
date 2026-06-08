import { Plant } from './plant.model';

// One day in milliseconds. Dates in JS are measured in ms, so we divide by this
// to turn a time difference into a number of days.
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** 0–100: how far through its watering cycle a plant is (>= 100 means it's due). */
export function wateringProgress(plant: Plant): number {
  const daysSinceWatered =
    (Date.now() - new Date(plant.lastWateredAt).getTime()) / MS_PER_DAY;
  const ratio = daysSinceWatered / plant.wateringFrequencyDays;
  return Math.min(100, Math.max(0, ratio * 100));
}

/** True when a plant is due (or overdue) for watering. */
export function needsWater(plant: Plant): boolean {
  return wateringProgress(plant) >= 100;
}
