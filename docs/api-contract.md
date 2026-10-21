# Review API contract

The review interface consumes this JSON API. The backend is not implemented yet; the Angular application uses an in-memory mock by default. `base URL` is configured in the Angular environment.

All item `data` objects use the fields and enum values defined for their resource type in [`../schemas/extraction.schema.json`](../schemas/extraction.schema.json), excluding `evidence`. Requests and responses use JSON.

## Data types

```ts
type ResourceType = "condition" | "medication" | "observation";
type ReviewStatus = "pending" | "approved" | "edited" | "rejected";

interface LetterSummary {
  id: string;
  title: string;
}

interface Letter {
  id: string;
  text: string;
}

interface EvidenceSpan {
  start: number;
  end: number;
}

interface ReviewedItem {
  item_id: string;
  resource_type: ResourceType;
  data: object;
  evidence: string;
  evidence_span: EvidenceSpan | null;
  review_status: ReviewStatus;
  edited_data: object | null;
  reject_reason: string | null;
}

interface Extraction {
  id: string;
  letter_id: string;
  model: string;
  prompt_version: string;
  created_at: string;
  items: ReviewedItem[];
}

interface ReviewRequest {
  action: "approve" | "edit" | "reject";
  data?: object;
  reason?: string;
  reviewer: string;
}

interface CommitResult {
  bundle_id: string;
  saved_items: number;
}
```

The TypeScript versions of these interfaces, with the schema-specific resource data types, are in `frontend/src/app/core/api.models.ts`.

`evidence_span` contains zero-based, half-open character offsets (`start` included, `end` excluded) into the exact letter text. It is `null` when the evidence quote cannot be located verbatim. The `data` field excludes evidence. For an edited item, `edited_data` contains the revised schema fields, also without evidence.

## Endpoints

### `GET /letters`

Returns the available letters:

```json
[
  { "id": "letter-001", "title": "Discharge letter" }
]
```

### `GET /letters/{id}`

Returns one letter:

```json
{ "id": "letter-001", "text": "Full letter text..." }
```

### `POST /letters/{id}/extract`

Starts or retrieves an extraction for a letter and returns an `Extraction`:

```json
{
  "id": "extraction-001",
  "letter_id": "letter-001",
  "model": "model-name",
  "prompt_version": "extract-v1",
  "created_at": "2026-01-15T10:00:00Z",
  "items": []
}
```

### `GET /extractions/{id}`

Returns the current `Extraction`, including all review decisions.

### `POST /extractions/{id}/items/{item_id}/review`

Records a review decision and returns the updated `ReviewedItem`.

Approve:

```json
{ "action": "approve", "reviewer": "Reviewer name" }
```

Edit:

```json
{
  "action": "edit",
  "data": { "text": "Revised condition", "role": "principale" },
  "reviewer": "Reviewer name"
}
```

The `data` fields must match the extraction schema for the item's resource type and must not include evidence.

Reject:

```json
{ "action": "reject", "reason": "Optional explanation", "reviewer": "Reviewer name" }
```

Review decisions may be changed until the extraction has been committed.

### `POST /extractions/{id}/commit`

Commits the reviewed extraction and returns the resulting FHIR Bundle identifier and count:

```json
{ "bundle_id": "bundle-001", "saved_items": 4 }
```

The interface only enables commit after every item has a non-pending review status. Rejected items are not counted as saved items.

## Data protection

Use synthetic data only. Do not send real patient documents to the mock or real API during development or testing.
