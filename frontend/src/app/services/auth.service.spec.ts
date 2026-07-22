import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'green-garden.token';

// A structurally valid JWT. Only the payload matters — nothing client-side
// verifies the signature, which is exactly the backend's job.
function tokenIssued(minutesAgo: number, lifetimeMinutes = 60): string {
  const iat = Math.floor(Date.now() / 1000) - minutesAgo * 60;
  const b64 = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ sub: '1', iat, exp: iat + lifetimeMinutes * 60 }),
    'not-a-real-signature',
  ].join('.');
}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpClient;
  let httpMock: HttpTestingController;

  // AuthService reads the token at construction, so the token has to be in
  // place before anything is injected.
  function signedInWith(storedToken: string): void {
    localStorage.setItem(TOKEN_KEY, storedToken);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    // Let the constructor's deferred profile fetch happen, then answer it —
    // the restore is not what these specs are about.
    flushMicrotasks();
    httpMock.expectOne(`${environment.apiUrl}/auth/me`).flush({
      id: '1',
      email: 'gardener@example.com',
      display_name: 'Gardener',
      created_at: '2026-07-21T00:00:00Z',
    });
  }

  // Ordinary authenticated traffic — the thing renewal rides on.
  function makeRequest(): void {
    http.get(`${environment.apiUrl}/plants`).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/plants`).flush([]);
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('renews a token that is past halfway through its life', fakeAsync(() => {
    // 45 minutes into a 60 minute life — halfway was at 30.
    signedInWith(tokenIssued(45));
    makeRequest();

    const renewed = tokenIssued(0);
    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush({ access_token: renewed, token_type: 'bearer' });

    expect(service.token()).toBe(renewed);
    expect(localStorage.getItem(TOKEN_KEY))
      .withContext('the renewed token must survive a reload')
      .toBe(renewed);
  }));

  it('leaves a token that is still fresh alone', fakeAsync(() => {
    signedInWith(tokenIssued(5));
    makeRequest();

    httpMock.expectNone(`${environment.apiUrl}/auth/refresh`);
  }));

  it('does not let renewal trigger itself', fakeAsync(() => {
    // The restore inside signedInWith is an /auth/ call on a stale token. If
    // those counted as traffic, renewal would recurse.
    signedInWith(tokenIssued(45));

    httpMock.expectNone(`${environment.apiUrl}/auth/refresh`);
  }));

  it('renews once across a burst of requests', fakeAsync(() => {
    signedInWith(tokenIssued(45));
    makeRequest();
    makeRequest();
    makeRequest();

    // expectOne fails outright if the burst produced more than one.
    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush({ access_token: tokenIssued(0), token_type: 'bearer' });
  }));

  it('keeps the session on a failed renewal rather than dropping the user', fakeAsync(() => {
    const original = tokenIssued(45);
    signedInWith(original);
    makeRequest();

    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush('nope', { status: 500, statusText: 'Server Error' });

    // The token we hold is still valid until it expires — a failed renewal is
    // not a reason to sign anyone out.
    expect(service.isLoggedIn()).toBeTrue();
    expect(service.token()).toBe(original);
  }));

  it('does not refetch the profile when only the token changed', fakeAsync(() => {
    signedInWith(tokenIssued(45));
    makeRequest();

    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush({ access_token: tokenIssued(0), token_type: 'bearer' });

    // signedInWith already consumed the one legitimate /auth/me.
    httpMock.expectNone(`${environment.apiUrl}/auth/me`);
  }));

  it('sends a password change in the shape the backend expects', fakeAsync(() => {
    signedInWith(tokenIssued(5));
    service.changePassword('secret123', 'brand-new-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/password`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      current_password: 'secret123',
      new_password: 'brand-new-1',
    });
    req.flush(null, { status: 204, statusText: 'No Content' });
  }));
});
