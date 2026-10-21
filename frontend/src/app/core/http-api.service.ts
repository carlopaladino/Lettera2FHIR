import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CommitResult,
  Extraction,
  Letter,
  LetterSummary,
  ApiService,
  ReviewRequest,
  ReviewedItem,
} from './api.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HttpApiService implements ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  listLetters(): Promise<LetterSummary[]> {
    return firstValueFrom(this.http.get<LetterSummary[]>(`${this.baseUrl}/letters`));
  }

  getLetter(id: string): Promise<Letter> {
    return firstValueFrom(this.http.get<Letter>(`${this.baseUrl}/letters/${encodeURIComponent(id)}`));
  }

  extractLetter(id: string): Promise<Extraction> {
    return firstValueFrom(
      this.http.post<Extraction>(
        `${this.baseUrl}/letters/${encodeURIComponent(id)}/extract`,
        {},
      ),
    );
  }

  getExtraction(id: string): Promise<Extraction> {
    return firstValueFrom(
      this.http.get<Extraction>(`${this.baseUrl}/extractions/${encodeURIComponent(id)}`),
    );
  }

  reviewItem(
    extractionId: string,
    itemId: string,
    request: ReviewRequest,
  ): Promise<ReviewedItem> {
    return firstValueFrom(
      this.http.post<ReviewedItem>(
        `${this.baseUrl}/extractions/${encodeURIComponent(extractionId)}/items/${encodeURIComponent(itemId)}/review`,
        request,
      ),
    );
  }

  commitExtraction(extractionId: string): Promise<CommitResult> {
    return firstValueFrom(
      this.http.post<CommitResult>(
        `${this.baseUrl}/extractions/${encodeURIComponent(extractionId)}/commit`,
        {},
      ),
    );
  }
}
