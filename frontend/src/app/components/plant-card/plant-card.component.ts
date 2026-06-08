import { Component, computed, input, output } from '@angular/core';
import { Plant } from '../../models/plant.model';
import { wateringProgress } from '../../models/watering';

@Component({
  selector: 'app-plant-card',
  imports: [],
  templateUrl: './plant-card.component.html',
  styleUrl: './plant-card.component.css',
})
export class PlantCardComponent {
  readonly plant = input.required<Plant>();
  readonly watered = output<string>();
  readonly delete = output<string>();
  readonly edit = output<Plant>();
  readonly consult = output<Plant>();

  readonly progressPercent = computed(() => wateringProgress(this.plant()));
  readonly needsWater = computed(() => this.progressPercent() >= 100);

  onWatered(): void {
    this.watered.emit(this.plant().id);
  }

  onDelete(): void {
    if (confirm(`Delete "${this.plant().name}"? This cannot be undone.`)) {
      this.delete.emit(this.plant().id);
    }
  }

  onEdit(): void {
    this.edit.emit(this.plant());
  }

  onConsult(): void {
    this.consult.emit(this.plant());
  }
}
