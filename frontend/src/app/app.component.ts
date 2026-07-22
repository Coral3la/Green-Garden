import { Component, computed, inject, signal } from '@angular/core';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PlantListComponent } from './components/plant-list/plant-list.component';
import { AuthFormComponent } from './components/auth-form/auth-form.component';
import { ChangePasswordComponent } from './components/change-password/change-password.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    PlantListComponent,
    DashboardComponent,
    AuthFormComponent,
    ChangePasswordComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private auth = inject(AuthService);

  title = 'Green-Garden';
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly sessionReady = this.auth.sessionReady;
  readonly user = this.auth.user;
  readonly changingPassword = signal(false);
  // The hero goes two-column whenever a card sits beside the copy, whichever
  // card that is.
  readonly heroHasCard = computed(
    () => !this.isLoggedIn() || this.changingPassword(),
  );

  onSignOut(): void {
    this.auth.logout();
  }
}
