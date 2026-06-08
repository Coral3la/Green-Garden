import { Component, inject, signal } from '@angular/core';
import { PlantCardComponent } from '../plant-card/plant-card.component';
import { PlantService } from '../../services/plant.service';
import { Plant } from '../../models/plant.model';
import { AddPlantFormComponent } from '../add-plant-form/add-plant-form.component';
import { BotanicExpertComponent } from '../botanic-expert/botanic-expert.component';

@Component({
  selector: 'app-plant-list',
  imports: [PlantCardComponent, AddPlantFormComponent, BotanicExpertComponent],
  templateUrl: './plant-list.component.html',
  styleUrl: './plant-list.component.css',
})
export class PlantListComponent {
  private plantService = inject(PlantService);
  readonly plants = this.plantService.plants;
  readonly loading = this.plantService.loading;
  readonly error = this.plantService.error;

  // --- Add / edit plant modal ---
  // modalOpen says whether the form is showing; editingPlant says which plant
  // we're editing (undefined = "add a new plant" mode).
  readonly modalOpen = signal(false);
  readonly editingPlant = signal<Plant | undefined>(undefined);

  // --- "Ask the expert" modal ---
  // A plant here = the modal is open for that plant; undefined = it's closed.
  readonly consultingPlant = signal<Plant | undefined>(undefined);

  openAddModal(): void {
    this.editingPlant.set(undefined); // undefined = "add mode" in the form
    this.modalOpen.set(true);
  }

  openEditModal(plant: Plant): void {
    this.editingPlant.set(plant); // form receives this via [plantToEdit]
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingPlant.set(undefined); // reset so next "Add" doesn't reopen in edit mode
  }

  openConsultModal(plant: Plant): void {
    this.consultingPlant.set(plant);
  }

  closeConsultModal(): void {
    this.consultingPlant.set(undefined);
  }

  onWatered(id: string): void {
    this.plantService.waterPlant(id);
  }

  onDelete(id: string): void {
    this.plantService.removePlant(id);
  }

  retryLoad(): void {
    this.plantService.loadPlants();
  }
}
