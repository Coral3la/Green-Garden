import { computed, effect, Injectable, signal } from '@angular/core';
import { Plant } from '../models/plant.model';

const STORAGE_KEY = 'green-garden-plants';

@Injectable({
  providedIn: 'root',
})
export class PlantService {
  updatePlant(id: string, updates: Partial<Omit<Plant, 'id'>>): void {
    this.plantsSignal.update((plants) =>
      plants.map((plant) =>
        plant.id === id ? { ...plant, ...updates } : plant,
      ),
    );
  }

  private plantsSignal = signal<Plant[]>(this.loadFromStorage());
  readonly plants = this.plantsSignal.asReadonly();
  readonly totalPlants = computed(() => this.plants().length);

  readonly plantsNeedingWater = computed(() => {
    const now = Date.now();
    const msPerDay = 1000 * 60 * 60 * 24;
    return this.plants().filter((plant) => {
      const timePassed = now - new Date(plant.lastWateredAt).getTime();
      return timePassed / msPerDay >= plant.wateringFrequencyDays;
    }).length;
  });

  constructor() {
    effect(() => {
      const plants = this.plants();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
    });
  }

  private loadFromStorage(): Plant[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return this.getSeedData();
    }
    try {
      const parsed = JSON.parse(raw) as Plant[];
      return parsed.map((p) => ({
        ...p,
        location: p.location ?? '',
        lastWateredAt: new Date(p.lastWateredAt),
      }));
    } catch {
      return this.getSeedData();
    }
  }
  private getSeedData(): Plant[] {
    return [
      {
        id: crypto.randomUUID(),
        name: 'Aloe Vera',
        imgUrl:
          'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=300',
        location: 'Kitchen windowsill, bright light',
        wateringFrequencyDays: 7,
        lastWateredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: crypto.randomUUID(),
        name: 'Monstera',
        imgUrl:
          'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=300',
        location: 'Living room, indirect light',
        wateringFrequencyDays: 5,
        lastWateredAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
      {
        id: crypto.randomUUID(),
        name: 'Cactus',
        imgUrl:
          'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=300',
        location: 'Bedroom, full sun',
        wateringFrequencyDays: 14,
        lastWateredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  waterPlant(id: string): void {
    this.plantsSignal.update((plants) =>
      plants.map((plant) =>
        plant.id === id ? { ...plant, lastWateredAt: new Date() } : plant,
      ),
    );
  }

  addPlant(
    name: string,
    imgUrl: string,
    location: string,
    wateringFrequencyDays: number,
  ): void {
    const newPlant: Plant = {
      id: crypto.randomUUID(),
      name,
      imgUrl,
      location,
      wateringFrequencyDays,
      lastWateredAt: new Date(),
    };
    this.plantsSignal.update((plants) => [...plants, newPlant]);
  }

  removePlant(id: string): void {
    this.plantsSignal.update((plants) =>
      plants.filter((plant) => plant.id !== id),
    );
  }
}
