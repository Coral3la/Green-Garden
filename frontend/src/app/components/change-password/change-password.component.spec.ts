import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { ChangePasswordComponent } from './change-password.component';
import { AuthService } from '../../services/auth.service';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';

describe('ChangePasswordComponent', () => {
  let component: ChangePasswordComponent;
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ChangePasswordComponent],
      providers: [
        // The interceptor is part of what this form's error handling depends
        // on, so it has to be wired the way app.config.ts wires it.
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function fillIn(current: string, next: string, confirm = next): void {
    component.passwordForm.setValue({
      currentPassword: current,
      newPassword: next,
      confirmPassword: confirm,
    });
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('will not submit when the confirmation does not match', () => {
    fillIn('secret123', 'brand-new-1', 'brand-new-2');
    expect(component.passwordForm.invalid).toBeTrue();

    component.onSubmit();
    httpMock.expectNone(`${environment.apiUrl}/auth/password`);
  });

  it('rejects a new password bcrypt could not store', () => {
    // 40 characters, 160 bytes — the byte ceiling the backend enforces.
    fillIn('secret123', '🌱'.repeat(40));
    expect(
      component.passwordForm.controls.newPassword.errors?.['maxBytes'],
    ).toBeTruthy();
  });

  it('confirms success rather than silently closing', () => {
    fillIn('secret123', 'brand-new-1');
    component.onSubmit();

    httpMock
      .expectOne(`${environment.apiUrl}/auth/password`)
      .flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(component.succeeded()).toBeTrue();
    expect(component.error()).toBeNull();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.pw--done')).toBeTruthy();
    // Nothing left on screen to resubmit or shoulder-surf.
    expect(compiled.querySelector('#currentPassword')).toBeNull();
  });

  it('keeps the user signed in when the current password is wrong', () => {
    // The interceptor logs out on a 401 from anywhere that is not checking
    // credentials the user just typed. Mistyping a password here must not be
    // treated as an expired token.
    localStorage.setItem('green-garden.token', 'a-token');
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
    expect(auth.isLoggedIn()).toBeTrue();

    fillIn('wrong-one', 'brand-new-1');
    component.onSubmit();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/password`)
      .flush(
        { detail: 'Current password is incorrect' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(auth.isLoggedIn())
      .withContext('a mistyped password must not end the session')
      .toBeTrue();
    expect(component.error()).toBe('That is not your current password.');
    expect(component.succeeded()).toBeFalse();
  });
});
