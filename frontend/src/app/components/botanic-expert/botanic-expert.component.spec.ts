import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { BotanicExpertComponent } from './botanic-expert.component';
import { environment } from '../../../environments/environment';
import { Plant } from '../../models/plant.model';

const PLANT: Plant = {
  id: '1',
  name: 'Monstera',
  imgUrl: 'monstera.jpg',
  location: 'Living room',
  wateringFrequencyDays: 7,
  lastWateredAt: new Date('2026-07-20T00:00:00Z'),
};

describe('BotanicExpertComponent', () => {
  let component: BotanicExpertComponent;
  let fixture: ComponentFixture<BotanicExpertComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BotanicExpertComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(BotanicExpertComponent);
    fixture.componentRef.setInput('plant', PLANT);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  // Asks a question and hands back the pending request to answer however the
  // spec likes.
  function ask() {
    component.userInput.set('Why are the leaves yellowing?');
    component.sendMessage();
    return httpMock.expectOne(`${environment.apiUrl}/chat`);
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('appends the reply to the conversation', () => {
    ask().flush({ reply: 'Too much water.' });

    expect(component.chatHistory().at(-1)).toEqual({
      role: 'assistant',
      content: 'Too much water.',
    });
    expect(component.errorMessage()).toBeNull();
  });

  it('reports a 503 as chat being switched off, not as a failure', () => {
    ask().flush(
      { detail: 'AI chat is not configured.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();

    // No red error, no composer — retrying a missing API key cannot help.
    expect(component.unavailable()).toBeTrue();
    expect(component.errorMessage()).toBeNull();
    expect(component.canSend()).toBeFalse();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.consult__off'))
      .withContext('a switched-off chat should say so')
      .toBeTruthy();
    expect(compiled.querySelector('.consult__input'))
      .withContext('the composer should be gone, not merely disabled')
      .toBeNull();
    expect(compiled.querySelector('.consult__error')).toBeNull();
  });

  it('reports a 502 as a temporary outage worth retrying', () => {
    ask().flush(
      { detail: 'The AI service returned an error.' },
      { status: 502, statusText: 'Bad Gateway' },
    );
    fixture.detectChanges();

    expect(component.unavailable())
      .withContext('the expert is down, not switched off')
      .toBeFalse();
    expect(component.errorMessage()).toContain('try again');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.consult__error')).toBeTruthy();
    expect(compiled.querySelector('.consult__input'))
      .withContext('a transient failure must leave the composer usable')
      .toBeTruthy();
  });

  it('distinguishes an unreachable backend from a failing one', () => {
    ask().error(new ProgressEvent('network error'));

    expect(component.errorMessage()).toContain('Is the backend running?');
    expect(component.unavailable()).toBeFalse();
  });
});
