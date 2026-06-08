import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Plant } from '../models/plant.model';

interface PlantDto {
  id: string;
  name: string;
  imgUrl: string;
  location: string;
  wateringFrequencyDays: number;
  lastWateredAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class PlantService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/plants`;
  private plantsSignal = signal<Plant[]>([]);
  readonly plants = this.plantsSignal.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
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
    this.loadPlants();
  }

  private toPlant(dto: PlantDto): Plant {
    return { ...dto, lastWateredAt: new Date(dto.lastWateredAt) };
  }

  loadPlants(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<PlantDto[]>(this.baseUrl).subscribe({
      next: (dtos) => {
        this.plantsSignal.set(dtos.map((dto) => this.toPlant(dto)));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load plants', err);
        this.error.set('Could not load your plants. Is the backend running?');
        this.loading.set(false);
      },
    });
  }

  addPlant(
    name: string,
    imgUrl: string,
    location: string,
    wateringFrequencyDays: number,
  ): void {
    const body = { name, imgUrl, location, wateringFrequencyDays };
    this.http.post<PlantDto>(this.baseUrl, body).subscribe({
      next: (dto) =>
        this.plantsSignal.update((plants) => [...plants, this.toPlant(dto)]),
      error: (err) => {
        console.error('Failed to add plant', err);
        this.error.set('Could not add the plant. Please try again.');
      },
    });
  }

  updatePlant(id: string, updates: Partial<Omit<Plant, 'id'>>): void {
    this.http.patch<PlantDto>(`${this.baseUrl}/${id}`, updates).subscribe({
      next: (dto) => this.replaceInCache(dto),
      error: (err) => {
        console.error('Failed to update plant', err);
        this.error.set('Could not save changes. Please try again.');
      },
    });
  }

  waterPlant(id: string): void {
    const lastWateredAt = new Date().toISOString();
    this.http
      .patch<PlantDto>(`${this.baseUrl}/${id}`, { lastWateredAt })
      .subscribe({
        next: (dto) => this.replaceInCache(dto),
        error: (err) => {
          console.error('Failed to water plant', err);
          this.error.set('Could not record watering. Please try again.');
        },
      });
  }

  removePlant(id: string): void {
    this.http.delete<void>(`${this.baseUrl}/${id}`).subscribe({
      next: () =>
        this.plantsSignal.update((plants) =>
          plants.filter((plant) => plant.id !== id),
        ),
      error: (err) => {
        console.error('Failed to remove plant', err);
        this.error.set('Could not delete the plant. Please try again.');
      },
    });
  }

  private replaceInCache(dto: PlantDto): void {
    const updated = this.toPlant(dto);
    this.plantsSignal.update((plants) =>
      plants.map((plant) => (plant.id === updated.id ? updated : plant)),
    );
  }
}
