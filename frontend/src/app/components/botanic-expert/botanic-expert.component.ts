import { Component, computed, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { Plant } from '../../models/plant.model';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAIResponse {
  choices: { message: { role: string; content: string } }[];
}

@Component({
  selector: 'app-botanic-expert',
  imports: [FormsModule],
  templateUrl: './botanic-expert.component.html',
  styleUrl: './botanic-expert.component.css',
})
export class BotanicExpertComponent {
  readonly plant = input.required<Plant>();

  // ⚠️ DEV ONLY: the API key is shipped to the browser and visible in DevTools.
  // For production, move this call to a backend (e.g. Python/FastAPI) that
  // holds the key server-side and proxies the request to OpenAI.
  private readonly apiKey = environment.openAiApiKey;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = 'gpt-4o-mini';

  private http = inject(HttpClient);

  readonly chatHistory = signal<ChatMessage[]>([]);
  readonly userInput = signal('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly canSend = computed(
    () => this.userInput().trim().length > 0 && !this.isLoading(),
  );

  private buildSystemPrompt(): string {
    const p = this.plant();
    const watered = new Date(p.lastWateredAt).toLocaleDateString();
    return (
      `You are an expert indoor plant agronomist. The user is growing a ` +
      `${p.name} located in ${p.location}, and it was last watered on ` +
      `${watered}. Answer the user's question short, professionally, and ` +
      `encouragingly. Break down your advice into clear, practical, ` +
      `actionable steps.`
    );
  }

  sendMessage(): void {
    const text = this.userInput().trim();
    if (!text || this.isLoading()) return;

    this.errorMessage.set(null);
    this.chatHistory.update((h) => [...h, { role: 'user', content: text }]);
    this.userInput.set('');
    this.isLoading.set(true);

    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      ...this.chatHistory(),
    ];

    this.http
      .post<OpenAIResponse>(
        this.apiUrl,
        { model: this.model, messages, temperature: 0.7 },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      )
      .subscribe({
        next: (res) => {
          const reply =
            res.choices?.[0]?.message?.content?.trim() ??
            'No response received.';
          this.chatHistory.update((h) => [
            ...h,
            { role: 'assistant', content: reply },
          ]);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('OpenAI request failed', err);
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
