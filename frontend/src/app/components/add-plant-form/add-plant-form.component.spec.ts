import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AddPlantFormComponent } from './add-plant-form.component';

describe('AddPlantFormComponent', () => {
  let component: AddPlantFormComponent;
  let fixture: ComponentFixture<AddPlantFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPlantFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddPlantFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
