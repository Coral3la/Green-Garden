import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';

interface TokenDto {
  access_token: string;
  token_type: string;
}

interface UserDto {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

const TOKEN_KEY = 'green-garden.token';

interface TokenClaims {
  iat: number;
  exp: number;
}

// Reads a JWT's payload *without verifying it*. That is safe only because the
// result is used for one thing: deciding when to ask for a new token. The
// backend verifies the signature on every request, so the worst a tampered
// `exp` can do here is provoke a refresh call that gets rejected.
function decodeClaims(token: string): TokenClaims | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as Partial<TokenClaims>;
    if (typeof claims.iat !== 'number' || typeof claims.exp !== 'number') {
      return null;
    }
    return { iat: claims.iat, exp: claims.exp };
  } catch {
    // A token we cannot read is one we cannot renew — leave it to expire and
    // let the backend be the judge.
    return null;
  }
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;
  private tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly token = this.tokenSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenSignal() !== null);
  private userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();
  // True only while a *stored* token is being checked on startup. A fresh
  // login never sets it — those credentials came straight from the backend.
  private restoringSignal = signal(false);
  readonly restoring = this.restoringSignal.asReadonly();
  // Guards against a burst of requests each firing their own renewal.
  private renewing = false;
  // We hold a token *and* have finished vetting it. This, not isLoggedIn, is
  // what the signed-in half of the app keys off: during a restore the token
  // may yet turn out to be expired, and acting on it flashes the whole garden
  // before bouncing the user back to the login form.
  readonly sessionReady = computed(
    () => this.isLoggedIn() && !this.restoring(),
  );

  constructor() {
    // A token restored from a previous session is only trustworthy until the
    // backend says otherwise, so fetch the profile to validate it. If it has
    // expired, the 401 sends us back through logout via the interceptor.
    if (this.tokenSignal()) {
      this.restoringSignal.set(true);
      // Deferred by a microtask on purpose. Firing the request straight from
      // the constructor makes authInterceptor inject() this service while it is
      // still being constructed, which Angular rejects as a circular
      // dependency (NG0200) — the request then dies before it is ever sent.
      // Yielding first lets construction finish so the interceptor resolves.
      queueMicrotask(() => this.loadCurrentUser());
    }
  }

  private toUser(dto: UserDto): User {
    return { id: dto.id, email: dto.email, displayName: dto.display_name };
  }

  login(email: string, password: string): Observable<TokenDto> {
    // The backend reads OAuth2's password form, so the field is `username`
    // even though users are looked up by email — and it must be form-encoded
    // rather than the JSON every other endpoint takes.
    const body = new URLSearchParams({ username: email, password });
    return this.http
      .post<TokenDto>(`${this.baseUrl}/login`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(tap((res) => this.setToken(res.access_token)));
  }

  // Registering returns the new user rather than a token, so log straight in
  // afterwards and hand back the same shape login() does.
  register(
    email: string,
    password: string,
    displayName: string,
  ): Observable<TokenDto> {
    const body = { email, password, display_name: displayName };
    return this.http
      .post<UserDto>(`${this.baseUrl}/register`, body)
      .pipe(switchMap(() => this.login(email, password)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
  }

  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  // Renew a token that is more than halfway through its life. Called from the
  // interceptor, so renewal rides on ordinary traffic: a user who keeps working
  // is never dropped at the login screen, while an idle session still lapses.
  renewIfStale(): void {
    const token = this.tokenSignal();
    if (!token || this.renewing) return;
    const claims = decodeClaims(token);
    if (!claims) return;
    const halfway = claims.iat + (claims.exp - claims.iat) / 2;
    if (Date.now() / 1000 < halfway) return;

    this.renewing = true;
    this.http
      .post<TokenDto>(`${this.baseUrl}/refresh`, {})
      .pipe(finalize(() => (this.renewing = false)))
      .subscribe({
        // Only the token changes — it is the same user, so the profile we
        // already hold is still good.
        next: (res) => this.storeToken(res.access_token),
        // Not fatal: the current token is valid until it expires, and a 401
        // has already been turned into a logout by the interceptor.
        error: (err) => console.error('Could not renew the session', err),
      });
  }

  private storeToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.tokenSignal.set(token);
  }

  private setToken(token: string): void {
    this.storeToken(token);
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    this.http
      .get<UserDto>(`${this.baseUrl}/me`)
      // finalize, not a flag set in both handlers: neither branch can leave the
      // app stuck behind a restoring gate it never clears.
      .pipe(finalize(() => this.restoringSignal.set(false)))
      .subscribe({
        next: (dto) => this.userSignal.set(this.toUser(dto)),
        // A 401 here is already handled by the interceptor, which logs us out.
        // Any other failure leaves us signed in with no profile, which is why
        // signing out stays reachable without one.
        error: (err) => console.error('Failed to load the current user', err),
      });
  }
}
