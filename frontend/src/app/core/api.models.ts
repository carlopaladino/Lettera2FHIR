export interface LetterSummary {
  id: string;
  title: string;
}

export interface Letter {
  id: string;
  text: string;
}

export type ResourceType = 'condition' | 'medication' | 'observation';
export type ReviewStatus = 'pending' | 'approved' | 'edited' | 'rejected';
export type ReviewAction = 'approve' | 'edit' | 'reject';

export interface ConditionData {
  text: string;
  role: 'principale' | 'secondaria' | 'anamnestica';
  clinical_status: 'active' | 'resolved' | 'unknown';
  verification_status: 'confirmed' | 'provisional' | 'refuted';
}

export interface MedicationData {
  name: string;
  dose: string | null;
  frequency: string | null;
  route:
    | 'orale'
    | 'endovenosa'
    | 'sottocutanea'
    | 'intramuscolare'
    | 'inalatoria'
    | 'transdermica'
    | 'altro'
    | null;
  status: 'active' | 'stopped' | 'intended' | 'unknown';
  context: 'domiciliare_pre_ricovero' | 'durante_ricovero' | 'alla_dimissione';
}

export interface ObservationData {
  name: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  timing: 'ingresso' | 'durante_ricovero' | 'dimissione' | 'non_specificato';
  interpretation: 'alto' | 'basso' | 'normale' | null;
}

export type ItemData = ConditionData | MedicationData | ObservationData;

export interface EvidenceSpan {
  start: number;
  end: number;
}

export interface ReviewedItem {
  item_id: string;
  resource_type: ResourceType;
  data: ItemData;
  evidence: string;
  evidence_span: EvidenceSpan | null;
  review_status: ReviewStatus;
  edited_data: ItemData | null;
  reject_reason: string | null;
}

export interface Extraction {
  id: string;
  letter_id: string;
  model: string;
  prompt_version: string;
  created_at: string;
  items: ReviewedItem[];
}

export interface ReviewRequest {
  action: ReviewAction;
  data?: ItemData;
  reason?: string;
  reviewer: string;
}

export interface CommitResult {
  bundle_id: string;
  saved_items: number;
}

export interface ApiService {
  listLetters(): Promise<LetterSummary[]>;
  getLetter(id: string): Promise<Letter>;
  extractLetter(id: string): Promise<Extraction>;
  getExtraction(id: string): Promise<Extraction>;
  reviewItem(
    extractionId: string,
    itemId: string,
    request: ReviewRequest,
  ): Promise<ReviewedItem>;
  commitExtraction(extractionId: string): Promise<CommitResult>;
}
