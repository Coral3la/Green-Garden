import { Component } from '@angular/core';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PlantListComponent } from './components/plant-list/plant-list.component';

@Component({
  selector: 'app-root',
  imports: [PlantListComponent, DashboardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Green-Garden';
}
