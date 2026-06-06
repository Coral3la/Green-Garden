import { Component, inject } from '@angular/core';
import { PlantService } from '../../services/plant.service';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private plantService = inject(PlantService);

  totalPlants = this.plantService.totalPlants;
  plantsNeedingWater = this.plantService.plantsNeedingWater;
}
