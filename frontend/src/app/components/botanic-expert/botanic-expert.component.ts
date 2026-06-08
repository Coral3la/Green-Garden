import { Component, computed, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { Plant } from '../../models/plant.model';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// What our backend sends back.
interface ChatResponse {
  reply: string;
}

@Component({
  selector: 'app-botanic-expert',
  imports: [FormsModule],
  templateUrl: './botanic-expert.component.html',
  styleUrl: './botanic-expert.component.css',
})
export class BotanicExpertComponent {
  readonly plant = input.required<Plant>();

  // We only ever talk to OUR backend now — no secret key in the browser.
  // The backend holds the OpenAI key and builds the prompt server-side.
  private readonly chatUrl = `${environment.apiUrl}/chat`;

  private http = inject(HttpClient);

  readonly chatHistory = signal<ChatMessage[]>([]);
  readonly userInput = signal('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly canSend = computed(
    () => this.userInput().trim().length > 0 && !this.isLoading(),
  );

  sendMessage(): void {
    const text = this.userInput().trim();
    if (!text || this.isLoading()) return;

    this.errorMessage.set(null);
    this.chatHistory.update((h) => [...h, { role: 'user', content: text }]);
    this.userInput.set('');
    this.isLoading.set(true);

    const p = this.plant();
    const body = {
      plant: {
        name: p.name,
        location: p.location,
        lastWateredAt: new Date(p.lastWateredAt).toISOString(),
      },
      messages: this.chatHistory(),
    };

    this.http.post<ChatResponse>(this.chatUrl, body).subscribe({
      next: (res) => {
        const reply = res.reply?.trim() || 'No response received.';
        this.chatHistory.update((h) => [
          ...h,
          { role: 'assistant', content: reply },
        ]);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Chat request failed', err);
        this.errorMessage.set(
          'Sorry, the consultation failed. Please try again.',
        );
        this.isLoading.set(false);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
