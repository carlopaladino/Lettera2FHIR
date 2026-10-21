import { EvidenceSpan } from './api.models';

export interface EvidenceRange {
  itemId: string;
  span: EvidenceSpan | null;
}

export interface TextSegment {
  start: number;
  end: number;
  text: string;
  itemIds: string[];
}

export function splitEvidenceSegments(
  text: string,
  ranges: readonly EvidenceRange[],
): TextSegment[] {
  if (!text.length) return [];

  const boundaries = new Set<number>([0, text.length]);
  const validRanges = ranges.flatMap(({ itemId, span }) => {
    if (
      !span ||
      !Number.isInteger(span.start) ||
      !Number.isInteger(span.end) ||
      span.start < 0 ||
      span.end > text.length ||
      span.start >= span.end
    ) {
      return [];
    }
    boundaries.add(span.start);
    boundaries.add(span.end);
    return [{ itemId, start: span.start, end: span.end }];
  });

  const sorted = [...boundaries].sort((a, b) => a - b);
  const segments: TextSegment[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    const itemIds = validRanges
      .filter((range) => range.start <= start && range.end >= end)
      .map((range) => range.itemId);
    const previous = segments.at(-1);
    if (
      previous &&
      previous.end === start &&
      previous.itemIds.join('\0') === itemIds.join('\0')
    ) {
      previous.end = end;
      previous.text += text.slice(start, end);
    } else {
      segments.push({ start, end, text: text.slice(start, end), itemIds });
    }
  }
  return segments;
}
