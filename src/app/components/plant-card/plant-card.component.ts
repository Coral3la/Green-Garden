import { Component, computed, input, output } from '@angular/core';
import { Plant } from '../../models/plant.model';

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

  readonly progressPercent = computed(() => {
    const plant = this.plant();
    const msSinceWatered = Date.now() - new Date(plant.lastWateredAt).getTime();
    const daysSinceWatered = msSinceWatered / (1000 * 60 * 60 * 24);
    const ratio = daysSinceWatered / plant.wateringFrequencyDays;
    return Math.min(100, Math.max(0, ratio * 100));
  });
  readonly needsWater = computed(() => {
    return this.progressPercent() >= 100;
  });

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
}
