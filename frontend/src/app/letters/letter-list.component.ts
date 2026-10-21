import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LetterSummary } from '../core/api.models';
import { REVIEW_API } from '../core/api.token';

@Component({
  selector: 'app-letter-list',
  imports: [RouterLink],
  templateUrl: './letter-list.component.html',
  styleUrl: './letter-list.component.css',
})
export class LetterListComponent implements OnInit {
  private readonly api = inject(REVIEW_API);
  protected readonly letters = signal<LetterSummary[]>([]);
  protected readonly error = signal('');
  protected readonly loading = signal(true);

  ngOnInit(): void {
    void this.loadLetters();
  }

  private async loadLetters(): Promise<void> {
    try {
      this.letters.set(await this.api.listLetters());
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Impossibile caricare le lettere.');
    } finally {
      this.loading.set(false);
    }
  }
}
