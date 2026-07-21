import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap } from 'rxjs';
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

  constructor() {
    // A token restored from a previous session is only trustworthy until the
    // backend says otherwise, so fetch the profile to validate it. If it has
    // expired, the 401 sends us back through logout via the interceptor.
    if (this.tokenSignal()) {
      this.loadCurrentUser();
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

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.tokenSignal.set(token);
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    this.http.get<UserDto>(`${this.baseUrl}/me`).subscribe({
      next: (dto) => this.userSignal.set(this.toUser(dto)),
      // A 401 here is already handled by the interceptor, which logs us out.
      error: (err) => console.error('Failed to load the current user', err),
    });
  }
}
