import { Component, inject, signal } from '@angular/core';
import { PlantCardComponent } from '../plant-card/plant-card.component';
import { PlantService } from '../../services/plant.service';
import { Plant } from '../../models/plant.model';
import { AddPlantFormComponent } from '../add-plant-form/add-plant-form.component';

@Component({
  selector: 'app-plant-list',
  imports: [PlantCardComponent, AddPlantFormComponent],
  templateUrl: './plant-list.component.html',
  styleUrl: './plant-list.component.css',
})
export class PlantListComponent {
  private plantService = inject(PlantService);
  readonly plants = this.plantService.plants;

  readonly modalOpen = signal(false);
  readonly editingPlant = signal<Plant | undefined>(undefined);

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

  onWatered(id: string): void {
    this.plantService.waterPlant(id);
  }

  onDelete(id: string): void {
    this.plantService.removePlant(id);
  }

  onFormSaved(): void {
    this.editingPlant.set(undefined);
  }

  onCancelEdit(): void {
    this.editingPlant.set(undefined);
  }
}
