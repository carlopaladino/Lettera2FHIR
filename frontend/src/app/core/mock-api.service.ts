import { Injectable } from '@angular/core';
import {
  CommitResult,
  Extraction,
  Letter,
  LetterSummary,
  ApiService,
  ReviewRequest,
  ReviewedItem,
} from './api.models';
import { updateReviewStatus } from './review-state';
import { MOCK_LETTERS } from '../fixtures/mock-letters';

@Injectable({ providedIn: 'root' })
export class MockApiService implements ApiService {
  private readonly letters = new Map(
    MOCK_LETTERS.map((letter) => [letter.id, letter] as const),
  );
  private readonly extractions = new Map<string, Extraction>();
  private readonly committed = new Set<string>();

  async listLetters(): Promise<LetterSummary[]> {
    await this.delay();
    return [...this.letters.values()].map(({ id, title }) => ({ id, title }));
  }

  async getLetter(id: string): Promise<Letter> {
    await this.delay();
    const letter = this.letters.get(id);
    if (!letter) throw new Error(`Letter "${id}" was not found.`);
    return { id: letter.id, text: letter.text };
  }

  async extractLetter(id: string): Promise<Extraction> {
    await this.delay();
    const letter = this.letters.get(id);
    if (!letter) throw new Error(`Letter "${id}" was not found.`);
    const existing = [...this.extractions.values()].find((item) => item.letter_id === id);
    if (existing) return structuredClone(existing);
    const extraction = structuredClone(letter.extraction);
    this.extractions.set(extraction.id, extraction);
    return structuredClone(extraction);
  }

  async getExtraction(id: string): Promise<Extraction> {
    await this.delay();
    const extraction = this.extractions.get(id);
    if (!extraction) throw new Error(`Extraction "${id}" was not found.`);
    return structuredClone(extraction);
  }

  async reviewItem(
    extractionId: string,
    itemId: string,
    request: ReviewRequest,
  ): Promise<ReviewedItem> {
    await this.delay();
    if (this.committed.has(extractionId)) {
      throw new Error('The extraction has already been committed.');
    }
    const extraction = this.requireExtraction(extractionId);
    const current = extraction.items.find((item) => item.item_id === itemId);
    if (!current) throw new Error(`Review item "${itemId}" was not found.`);

    const updated = updateReviewStatus(
      extraction,
      itemId,
      request.action === 'approve'
        ? 'approved'
        : request.action === 'edit'
          ? 'edited'
          : 'rejected',
      request.action === 'edit' ? request.data ?? current.data : null,
      request.action === 'reject' ? (request.reason ?? null) : null,
    );
    this.extractions.set(extractionId, updated);
    const result = updated.items.find((item) => item.item_id === itemId);
    if (!result) throw new Error(`Updated review item "${itemId}" was not found.`);
    return structuredClone(result);
  }

  async commitExtraction(extractionId: string): Promise<CommitResult> {
    await this.delay();
    const extraction = this.requireExtraction(extractionId);
    if (extraction.items.some((item) => item.review_status === 'pending')) {
      throw new Error('All items must be reviewed before the extraction can be committed.');
    }
    if (this.committed.has(extractionId)) {
      throw new Error('The extraction has already been committed.');
    }
    this.committed.add(extractionId);
    return {
      bundle_id: `mock-bundle-${extractionId}`,
      saved_items: extraction.items.filter(
        (item) => item.review_status === 'approved' || item.review_status === 'edited',
      ).length,
    };
  }

  private requireExtraction(id: string): Extraction {
    const extraction = this.extractions.get(id);
    if (!extraction) throw new Error(`Extraction "${id}" was not found.`);
    return extraction;
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 120));
  }
}
