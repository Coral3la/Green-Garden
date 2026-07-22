import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlantCardComponent } from './plant-card.component';
import { Plant } from '../../models/plant.model';

const mockPlant: Plant = {
  id: '1',
  name: 'Monstera',
  imgUrl: 'https://example.com/monstera.jpg',
  location: 'Living room',
  wateringFrequencyDays: 7,
  lastWateredAt: new Date(),
};

describe('PlantCardComponent', () => {
  let component: PlantCardComponent;
  let fixture: ComponentFixture<PlantCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlantCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PlantCardComponent);
    component = fixture.componentInstance;
    // `plant` is a required input — it must be set before the first detectChanges.
    fixture.componentRef.setInput('plant', mockPlant);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
