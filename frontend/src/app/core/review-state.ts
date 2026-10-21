import { Extraction, ReviewedItem, ReviewStatus } from './api.models';

export function reviewedCount(items: readonly ReviewedItem[]): number {
  return items.filter((item) => item.review_status !== 'pending').length;
}

export function canCommit(items: readonly ReviewedItem[]): boolean {
  return items.length > 0 && items.every((item) => item.review_status !== 'pending');
}

export function updateReviewStatus(
  extraction: Extraction,
  itemId: string,
  status: Exclude<ReviewStatus, 'pending'>,
  editedData: ReviewedItem['edited_data'] = null,
  rejectReason: string | null = null,
): Extraction {
  if (!extraction.items.some((item) => item.item_id === itemId)) {
    throw new Error(`Review item "${itemId}" was not found.`);
  }

  return {
    ...extraction,
    items: extraction.items.map((item) =>
      item.item_id === itemId
        ? {
            ...item,
            review_status: status,
            edited_data: status === 'edited' ? editedData : null,
            reject_reason: status === 'rejected' ? rejectReason : null,
          }
        : item,
    ),
  };
}
