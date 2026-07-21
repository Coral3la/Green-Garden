import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Plant } from '../models/plant.model';
import { needsWater } from '../models/watering';
import { AuthService } from './auth.service';

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
  private auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/plants`;
  private plantsSignal = signal<Plant[]>([]);
  readonly plants = this.plantsSignal.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalPlants = computed(() => this.plants().length);
  readonly plantsNeedingWater = computed(
    () => this.plants().filter(needsWater).length,
  );

  constructor() {
    // Plants are per-user now, so loading them is driven by auth rather than
    // done once on startup: fetch when a token arrives, and clear on logout so
    // the next user never sees the previous one's garden.
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.loadPlants();
      } else {
        this.plantsSignal.set([]);
      }
    });
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
        this.fail(
          'Failed to load plants',
          'Could not load your plants. Is the backend running?',
          err,
        );
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
    this.error.set(null);
    const body = { name, imgUrl, location, wateringFrequencyDays };
    this.http.post<PlantDto>(this.baseUrl, body).subscribe({
      next: (dto) =>
        this.plantsSignal.update((plants) => [...plants, this.toPlant(dto)]),
      error: (err) =>
        this.fail(
          'Failed to add plant',
          'Could not add the plant. Please try again.',
          err,
        ),
    });
  }

  updatePlant(id: string, updates: Partial<Omit<Plant, 'id'>>): void {
    this.error.set(null);
    this.http.patch<PlantDto>(`${this.baseUrl}/${id}`, updates).subscribe({
      next: (dto) => this.replaceInCache(dto),
      error: (err) =>
        this.fail(
          'Failed to update plant',
          'Could not save changes. Please try again.',
          err,
        ),
    });
  }

  waterPlant(id: string): void {
    this.error.set(null);
    const lastWateredAt = new Date().toISOString();
    this.http
      .patch<PlantDto>(`${this.baseUrl}/${id}`, { lastWateredAt })
      .subscribe({
        next: (dto) => this.replaceInCache(dto),
        error: (err) =>
          this.fail(
            'Failed to water plant',
            'Could not record watering. Please try again.',
            err,
          ),
      });
  }

  removePlant(id: string): void {
    this.error.set(null);
    this.http.delete<void>(`${this.baseUrl}/${id}`).subscribe({
      next: () =>
        this.plantsSignal.update((plants) =>
          plants.filter((plant) => plant.id !== id),
        ),
      error: (err) =>
        this.fail(
          'Failed to remove plant',
          'Could not delete the plant. Please try again.',
          err,
        ),
    });
  }

  private replaceInCache(dto: PlantDto): void {
    const updated = this.toPlant(dto);
    this.plantsSignal.update((plants) =>
      plants.map((plant) => (plant.id === updated.id ? updated : plant)),
    );
  }

  // Logs the technical error for us and shows a friendly message to the user.
  private fail(logMessage: string, userMessage: string, err: unknown): void {
    console.error(logMessage, err);
    this.error.set(userMessage);
  }
}
