import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AuthFormComponent } from './auth-form.component';
import { environment } from '../../../environments/environment';

describe('AuthFormComponent', () => {
  let component: AuthFormComponent;
  let fixture: ComponentFixture<AuthFormComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthFormComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Catches requests no spec accounted for — a silent extra call to /auth/me
    // or /auth/login would otherwise pass unnoticed.
    httpMock.verify();
    // A successful login stores a token, and localStorage outlives the TestBed.
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not require a display name when signing in', () => {
    expect(component.isRegister()).toBeFalse();
    expect(component.authForm.controls.displayName.disabled).toBeTrue();

    component.authForm.patchValue({
      email: 'gardener@example.com',
      password: 'secret123',
    });
    expect(component.authForm.valid).toBeTrue();
  });

  it('should require a display name once switched to registering', () => {
    component.toggleMode();
    fixture.detectChanges();

    expect(component.authForm.controls.displayName.enabled).toBeTrue();
    component.authForm.patchValue({
      email: 'gardener@example.com',
      password: 'secret123',
    });
    expect(component.authForm.valid).toBeFalse();
  });

  it('should post the login as an OAuth2 form body', () => {
    component.authForm.patchValue({
      email: 'gardener@example.com',
      password: 'secret123',
    });
    component.onSubmit();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.headers.get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    );
    // The backend reads OAuth2's form, so the email travels as `username`.
    expect(req.request.body).toContain('username=gardener%40example.com');
    req.flush({ access_token: 'a-token', token_type: 'bearer' });

    // Storing the token triggers a profile fetch.
    httpMock.expectOne(`${environment.apiUrl}/auth/me`).flush({
      id: '1',
      email: 'gardener@example.com',
      display_name: 'Gardener',
      created_at: '2026-07-21T00:00:00Z',
    });
    expect(component.submitting()).toBeFalse();
  });

  it('should surface a friendly message when credentials are rejected', () => {
    component.authForm.patchValue({
      email: 'gardener@example.com',
      password: 'wrong-one',
    });
    component.onSubmit();

    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush(
        { detail: 'Incorrect email or password' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(component.error()).toBe('Incorrect email or password.');
    expect(component.submitting()).toBeFalse();
  });
});
