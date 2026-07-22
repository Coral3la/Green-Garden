import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Endpoints that check credentials the user has just typed. A 401 from one of
// these means "wrong password", which is the form's error to show — mistyping
// it must not tear down a perfectly good session. A 401 from anywhere else
// means our *token* is the problem.
const CREDENTIAL_CHECKS = ['/auth/login', '/auth/password'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const authorized = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  // Renewal rides on ordinary traffic: an authenticated request means the user
  // is still working, so a token past halfway is swapped for a fresh one. The
  // /auth/ calls are skipped so that renewing cannot trigger itself.
  if (token && !req.url.includes('/auth/')) {
    auth.renewIfStale();
  }

  return next(authorized).pipe(
    catchError((err: HttpErrorResponse) => {
      const checksTypedCredentials = CREDENTIAL_CHECKS.some((path) =>
        req.url.endsWith(path),
      );
      if (err.status === 401 && !checksTypedCredentials) {
        // Our token is missing or expired — drop it and fall back to login.
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
