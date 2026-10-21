import { describe, expect, it } from 'vitest';
import { MOCK_LETTERS } from './mock-letters';

describe('mock letters', () => {
  it('uses short synthetic letters and 8–12 items for each', () => {
    expect(MOCK_LETTERS).toHaveLength(2);
    for (const letter of MOCK_LETTERS) {
      const wordCount = letter.text.trim().split(/\s+/).length;
      expect(wordCount).toBeGreaterThanOrEqual(150);
      expect(wordCount).toBeLessThanOrEqual(250);
      expect(letter.extraction.items.length).toBeGreaterThanOrEqual(8);
      expect(letter.extraction.items.length).toBeLessThanOrEqual(12);
      expect(new Set(letter.extraction.items.map((item) => item.resource_type))).toEqual(
        new Set(['condition', 'medication', 'observation']),
      );
    }
  });

  it('computes exact evidence offsets and includes a deliberately missing quote', () => {
    const items = MOCK_LETTERS.flatMap((letter) =>
      letter.extraction.items.map((item) => ({ letter, item })),
    );
    const missing = items.filter(({ item }) => item.evidence_span === null);
    expect(missing).toHaveLength(1);
    for (const { letter, item } of items) {
      if (item.evidence_span) {
        expect(letter.text.slice(item.evidence_span.start, item.evidence_span.end)).toBe(
          item.evidence,
        );
      } else {
        expect(letter.text.includes(item.evidence)).toBe(false);
      }
    }
  });

  it('covers required clinical and medication enum examples', () => {
    const items = MOCK_LETTERS.flatMap((letter) => letter.extraction.items);
    expect(
      items.some(
        (item) => item.resource_type === 'condition' && item.data.verification_status === 'refuted',
      ),
    ).toBe(true);
    expect(
      items.some(
        (item) =>
          item.resource_type === 'condition' &&
          item.data.verification_status === 'provisional',
      ),
    ).toBe(true);
    expect(
      items.some(
        (item) => item.resource_type === 'medication' && item.data.status === 'stopped',
      ),
    ).toBe(true);
  });
});
