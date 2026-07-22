import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import {
  catchError,
  EMPTY,
  map,
  merge,
  Observable,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
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

  // Manual refreshes join the same pipeline as auth changes, so there is only
  // ever one load in flight.
  private reload$ = new Subject<void>();

  constructor() {
    // Plants are per-user now, so loading them is driven by auth rather than
    // done once on startup: fetch when a token arrives, and clear on logout so
    // the next user never sees the previous one's garden.
    //
    // switchMap, not a bare subscribe: signing out has to *cancel* the request
    // in flight. Otherwise its response lands after the list was cleared and
    // repopulates it — and if it arrives once the next user is already signed
    // in, they are looking at the previous user's plants.
    //
    // Keyed on sessionReady rather than isLoggedIn so a restored token is
    // vetted first. Racing /auth/me means an expired token costs two 401s and
    // reports itself as "Could not load your plants. Is the backend running?"
    // — a wrong answer to the wrong question.
    merge(
      toObservable(this.auth.sessionReady),
      this.reload$.pipe(map(() => this.auth.sessionReady())),
    )
      .pipe(
        switchMap((ready) => {
          if (!ready) {
            this.plantsSignal.set([]);
            this.loading.set(false);
            this.error.set(null);
            return EMPTY;
          }
          return this.fetchPlants();
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private toPlant(dto: PlantDto): Plant {
    return { ...dto, lastWateredAt: new Date(dto.lastWateredAt) };
  }

  // Refresh on demand — the retry button after a failed load. Routed through
  // the pipeline rather than fetching directly, so a second press cancels the
  // first instead of racing it.
  loadPlants(): void {
    this.reload$.next();
  }

  private fetchPlants(): Observable<PlantDto[]> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<PlantDto[]>(this.baseUrl).pipe(
      tap((dtos) => {
        this.plantsSignal.set(dtos.map((dto) => this.toPlant(dto)));
        this.loading.set(false);
      }),
      catchError((err) => {
        this.fail(
          'Failed to load plants',
          'Could not load your plants. Is the backend running?',
          err,
        );
        this.loading.set(false);
        // Swallowed on purpose: the failure is already reported on `error`,
        // and the outer pipeline has to survive for the next login or retry.
        return EMPTY;
      }),
    );
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
