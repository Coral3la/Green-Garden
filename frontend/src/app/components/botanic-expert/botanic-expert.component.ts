import { Component, computed, inject, input, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
  // A 503 means this server has no OpenAI key: chat is *off*, not broken.
  // Retrying can never help, so the composer closes rather than inviting the
  // user to keep trying against a red error.
  readonly unavailable = signal(false);

  readonly canSend = computed(
    () =>
      this.userInput().trim().length > 0 &&
      !this.isLoading() &&
      !this.unavailable(),
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
      error: (err: HttpErrorResponse) => {
        console.error('Chat request failed', err);
        this.isLoading.set(false);
        if (err.status === 503) {
          this.unavailable.set(true);
          return;
        }
        this.errorMessage.set(this.messageFor(err));
      },
    });
  }

  private messageFor(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Could not reach the server. Is the backend running?';
    }
    if (err.status === 502) {
      return 'The botanic expert is unreachable right now. Please try again in a moment.';
    }
    // A 401 unmounts the garden before this renders — the interceptor clears
    // the session — so this is a safety net rather than a message users see.
    if (err.status === 401) {
      return 'Your session expired. Sign in again to keep chatting.';
    }
    return 'Sorry, the consultation failed. Please try again.';
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
