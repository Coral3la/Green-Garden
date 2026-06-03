import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlantService } from '../../services/plant.service';
import { Plant } from '../../models/plant.model';

@Component({
  selector: 'app-add-plant-form',
  imports: [ReactiveFormsModule],
  templateUrl: './add-plant-form.component.html',
  styleUrl: './add-plant-form.component.css',
})
export class AddPlantFormComponent {
  private formBuilder = inject(FormBuilder);
  private plantService = inject(PlantService);

  readonly plantToEdit = input<Plant>();
  readonly formSaved = output<void>();
  readonly cancel = output<void>();

  plantForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    imgUrl: ['', [Validators.required]],
    location: ['', [Validators.required]],
    wateringFrequencyDays: [7, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    effect(() => {
      const plant = this.plantToEdit();
      if (plant) {
        this.plantForm.setValue({
          name: plant.name,
          imgUrl: plant.imgUrl,
          location: plant.location,
          wateringFrequencyDays: plant.wateringFrequencyDays,
        });
      } else {
        this.plantForm.reset();
      }
    });
  }

  onSubmit(): void {
    if (this.plantForm.invalid) {
      this.plantForm.markAllAsTouched();
      return;
    }
    const { name, imgUrl, location, wateringFrequencyDays } =
      this.plantForm.getRawValue();
    const plant = this.plantToEdit();

    if (plant) {
      this.plantService.updatePlant(plant.id, {
        name,
        imgUrl,
        location,
        wateringFrequencyDays,
      });
    } else {
      this.plantService.addPlant(name, imgUrl, location, wateringFrequencyDays);
    }

    this.plantForm.reset();
    this.formSaved.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
