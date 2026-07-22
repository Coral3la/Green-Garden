import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { PlantService } from './plant.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('PlantService', () => {
  let service: PlantService;
  let auth: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // AuthService reads the token at construction, so start every test signed
    // out and let the specs sign in explicitly.
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlantService);
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Cancelled requests do not count as outstanding, so this still allows the
    // deliberately-abandoned load in the logout specs.
    httpMock.verify();
    localStorage.clear();
  });

  // The load is driven by an effect behind toObservable, so the auth change
  // has to be flushed before the request exists.
  function signIn(): void {
    auth.login('gardener@example.com', 'secret123').subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ access_token: 'a-token', token_type: 'bearer' });
    httpMock.expectOne(`${environment.apiUrl}/auth/me`).flush({
      id: '1',
      email: 'gardener@example.com',
      display_name: 'Gardener',
      created_at: '2026-07-21T00:00:00Z',
    });
    TestBed.flushEffects();
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads the garden once a token arrives', () => {
    signIn();

    httpMock.expectOne(`${environment.apiUrl}/plants`).flush([
      {
        id: '1',
        name: 'Monstera',
        imgUrl: 'monstera.jpg',
        location: 'Living room',
        wateringFrequencyDays: 7,
        lastWateredAt: '2026-07-20T00:00:00Z',
      },
    ]);

    expect(service.totalPlants()).toBe(1);
  });

  it('cancels an in-flight load on logout, so the next user cannot see the previous garden', () => {
    signIn();
    const staleLoad = httpMock.expectOne(`${environment.apiUrl}/plants`);

    // Sign out while the first user's plants are still on the wire.
    auth.logout();
    TestBed.flushEffects();

    expect(staleLoad.cancelled)
      .withContext('the previous garden must not still be arriving')
      .toBeTrue();
    expect(service.totalPlants()).toBe(0);
  });

  it('shows the next user an empty garden, not the previous one', () => {
    signIn();
    // The first user's load never comes back — they sign out mid-flight.
    httpMock.expectOne(`${environment.apiUrl}/plants`);
    auth.logout();
    TestBed.flushEffects();

    // The second user signs in and has no plants of their own.
    signIn();
    httpMock.expectOne(`${environment.apiUrl}/plants`).flush([]);

    expect(service.plants()).toEqual([]);
  });
});
