import { describe, expect, it } from 'vitest';
import { Extraction, ReviewedItem } from './api.models';
import { canCommit, reviewedCount, updateReviewStatus } from './review-state';

const item = (itemId: string): ReviewedItem => ({
  item_id: itemId,
  resource_type: 'condition',
  data: {
    text: 'Bronchite',
    role: 'principale',
    clinical_status: 'active',
    verification_status: 'confirmed',
  },
  evidence: 'Bronchite acuta.',
  evidence_span: { start: 0, end: 16 },
  review_status: 'pending',
  edited_data: null,
  reject_reason: null,
});

const extraction: Extraction = {
  id: 'extraction-1',
  letter_id: 'letter-1',
  model: 'test-model',
  prompt_version: 'test-v1',
  created_at: '2026-01-01T00:00:00Z',
  items: [item('one'), item('two')],
};

describe('review state', () => {
  it('updates approve, edit and reject states and clears stale decision data', () => {
    const approved = updateReviewStatus(extraction, 'one', 'approved');
    expect(approved.items[0].review_status).toBe('approved');
    expect(approved.items[0].edited_data).toBeNull();

    const modifiedData = { ...item('two').data, text: 'Bronchite modificata' };
    const edited = updateReviewStatus(approved, 'two', 'edited', modifiedData);
    expect(edited.items[1].review_status).toBe('edited');
    expect(edited.items[1].edited_data).toEqual(modifiedData);

    const rejected = updateReviewStatus(edited, 'two', 'rejected', null, 'Non supportato');
    expect(rejected.items[1].review_status).toBe('rejected');
    expect(rejected.items[1].edited_data).toBeNull();
    expect(rejected.items[1].reject_reason).toBe('Non supportato');
  });

  it('counts reviewed items and enables commit only when none are pending', () => {
    expect(reviewedCount(extraction.items)).toBe(0);
    expect(canCommit(extraction.items)).toBe(false);

    const oneReviewed = updateReviewStatus(extraction, 'one', 'approved');
    expect(reviewedCount(oneReviewed.items)).toBe(1);
    expect(canCommit(oneReviewed.items)).toBe(false);

    const allReviewed = updateReviewStatus(oneReviewed, 'two', 'rejected');
    expect(reviewedCount(allReviewed.items)).toBe(2);
    expect(canCommit(allReviewed.items)).toBe(true);
  });

  it('rejects an update for an unknown item', () => {
    expect(() => updateReviewStatus(extraction, 'missing', 'approved')).toThrow(
      'Review item "missing" was not found.',
    );
  });
});
