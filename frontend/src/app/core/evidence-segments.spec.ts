import { describe, expect, it } from 'vitest';
import { splitEvidenceSegments } from './evidence-segments';

describe('splitEvidenceSegments', () => {
  it('splits overlapping evidence ranges without losing any text', () => {
    const segments = splitEvidenceSegments('abcdefgh', [
      { itemId: 'first', span: { start: 1, end: 5 } },
      { itemId: 'second', span: { start: 3, end: 7 } },
    ]);

    expect(segments.map(({ text, itemIds }) => [text, itemIds])).toEqual([
      ['a', []],
      ['bc', ['first']],
      ['de', ['first', 'second']],
      ['fg', ['second']],
      ['h', []],
    ]);
    expect(segments.map(({ text }) => text).join('')).toBe('abcdefgh');
  });

  it('handles spans at the start and end of the letter', () => {
    const segments = splitEvidenceSegments('abcdef', [
      { itemId: 'start', span: { start: 0, end: 2 } },
      { itemId: 'end', span: { start: 4, end: 6 } },
    ]);

    expect(segments.map(({ text, itemIds }) => [text, itemIds])).toEqual([
      ['ab', ['start']],
      ['cd', []],
      ['ef', ['end']],
    ]);
  });

  it('ignores null spans and preserves the complete text', () => {
    const segments = splitEvidenceSegments('test text', [
      { itemId: 'missing', span: null },
    ]);

    expect(segments).toEqual([
      { start: 0, end: 9, text: 'test text', itemIds: [] },
    ]);
  });
});
