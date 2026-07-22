import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-auth-form',
  imports: [ReactiveFormsModule],
  templateUrl: './auth-form.component.html',
  styleUrl: './auth-form.component.css',
})
export class AuthFormComponent {
  private formBuilder = inject(FormBuilder);
  private auth = inject(AuthService);

  readonly mode = signal<Mode>('login');
  readonly isRegister = computed(() => this.mode() === 'register');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  // Password and display-name rules mirror the backend's UserCreate model, so
  // the form catches what the API would reject anyway.
  authForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    displayName: ['', [Validators.required, Validators.minLength(2)]],
  });

  constructor() {
    // Logging in needs no display name. Disabling rather than removing the
    // control keeps it out of the form's validity while preserving what was
    // typed if the user toggles back to registering.
    effect(() => {
      const displayName = this.authForm.controls.displayName;
      if (this.isRegister()) {
        displayName.enable();
      } else {
        displayName.disable();
      }
    });
  }

  toggleMode(): void {
    this.mode.update((mode) => (mode === 'login' ? 'register' : 'login'));
    this.error.set(null);
  }

  onSubmit(): void {
    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
      return;
    }
    const { email, password, displayName } = this.authForm.getRawValue();
    this.submitting.set(true);
    this.error.set(null);

    const request = this.isRegister()
      ? this.auth.register(email, password, displayName)
      : this.auth.login(email, password);

    // On success the token lands in AuthService and the app swaps this form
    // out for the garden, so there is nothing left to do here.
    request.subscribe({
      next: () => this.submitting.set(false),
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.fail(err);
      },
    });
  }

  // Logs the technical error for us and shows a friendly message to the user.
  private fail(err: HttpErrorResponse): void {
    console.error('Authentication failed', err);
    this.error.set(this.messageFor(err));
  }

  private messageFor(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Could not reach the server. Is the backend running?';
    }
    if (err.status === 401) {
      return 'Incorrect email or password.';
    }
    if (err.status === 400) {
      return 'That email is already registered. Try signing in instead.';
    }
    if (err.status === 422) {
      return 'Please check the details you entered and try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
