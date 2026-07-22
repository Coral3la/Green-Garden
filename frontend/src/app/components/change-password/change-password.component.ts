import { Component, inject, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

// bcrypt's ceiling, mirrored from the backend's `Password` type. Counted in
// bytes rather than characters for the same reason it is there: a 40-emoji
// password is 160 bytes and the server would reject it.
const PASSWORD_MAX_BYTES = 72;

function maxBytes(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    return new TextEncoder().encode(value).length > max
      ? { maxBytes: max }
      : null;
  };
}

// Group-level: confirmation is only meaningful against the field it confirms.
const passwordsMatch: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
};

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent {
  private formBuilder = inject(FormBuilder);
  private auth = inject(AuthService);

  readonly closed = output<void>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly succeeded = signal(false);

  // Rules mirror the backend's `Password` type, so the form catches what the
  // API would reject anyway.
  passwordForm = this.formBuilder.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(6),
          maxBytes(PASSWORD_MAX_BYTES),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  onSubmit(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.submitting.set(true);
    this.error.set(null);

    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.submitting.set(false);
        this.succeeded.set(true);
        // Nothing should be left on screen to resubmit or shoulder-surf.
        this.passwordForm.reset();
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        console.error('Password change failed', err);
        this.error.set(this.messageFor(err));
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  private messageFor(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Could not reach the server. Is the backend running?';
    }
    if (err.status === 401) {
      return 'That is not your current password.';
    }
    if (err.status === 422) {
      return 'Please check the new password and try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
