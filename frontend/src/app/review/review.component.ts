import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Extraction,
  ItemData,
  ResourceType,
  ReviewedItem,
} from '../core/api.models';
import {
  EvidenceRange,
  TextSegment,
  splitEvidenceSegments,
} from '../core/evidence-segments';
import { REVIEW_API } from '../core/api.token';
import { canCommit, reviewedCount } from '../core/review-state';

interface ItemGroup {
  type: ResourceType;
  title: string;
  items: ReviewedItem[];
}

interface EditField {
  name: string;
  label: string;
  kind: 'text' | 'number' | 'select';
  options?: readonly (string | null)[];
}

const FIELD_LABELS: Record<string, string> = {
  text: 'Diagnosi',
  role: 'Ruolo',
  clinical_status: 'Stato clinico',
  verification_status: 'Verifica',
  name: 'Nome',
  dose: 'Dose',
  frequency: 'Frequenza',
  route: 'Via',
  status: 'Stato',
  context: 'Contesto',
  value_numeric: 'Valore numerico',
  value_text: 'Valore testuale',
  unit: 'Unità',
  timing: 'Momento',
  interpretation: 'Interpretazione',
};

const ENUMS: Record<string, readonly (string | null)[]> = {
  role: ['principale', 'secondaria', 'anamnestica'],
  clinical_status: ['active', 'resolved', 'unknown'],
  verification_status: ['confirmed', 'provisional', 'refuted'],
  route: ['orale', 'endovenosa', 'sottocutanea', 'intramuscolare', 'inalatoria', 'transdermica', 'altro', null],
  status: ['active', 'stopped', 'intended', 'unknown'],
  context: ['domiciliare_pre_ricovero', 'durante_ricovero', 'alla_dimissione'],
  timing: ['ingresso', 'durante_ricovero', 'dimissione', 'non_specificato'],
  interpretation: ['alto', 'basso', 'normale', null],
};

const ENUM_LABELS: Record<string, string> = {
  principale: 'Principale',
  secondaria: 'Secondaria',
  anamnestica: 'Anamnestica',
  active: 'Attivo',
  resolved: 'Risolto',
  unknown: 'Non specificato',
  confirmed: 'Confermato',
  provisional: 'Provvisorio',
  refuted: 'Escluso',
  stopped: 'Sospeso',
  intended: 'Prescritto',
  orale: 'Orale',
  endovenosa: 'Endovenosa',
  sottocutanea: 'Sottocutanea',
  intramuscolare: 'Intramuscolare',
  inalatoria: 'Inalatoria',
  transdermica: 'Transdermica',
  altro: 'Altro',
  domiciliare_pre_ricovero: 'A domicilio prima del ricovero',
  durante_ricovero: 'Durante il ricovero',
  alla_dimissione: 'Alla dimissione',
  ingresso: 'Ingresso',
  dimissione: 'Dimissione',
  non_specificato: 'Non specificato',
  alto: 'Alto',
  basso: 'Basso',
  normale: 'Normale',
};

const HIGHLIGHT_COLORS: Record<ReviewedItem['review_status'], string> = {
  pending: '#f6d86b',
  approved: '#72c5a1',
  edited: '#84b7ed',
  rejected: '#ed9a92',
};

function hasExactFields(data: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(data);
  return keys.length === fields.length && fields.every((field) => Object.hasOwn(data, field));
}

function isItemData(
  data: Record<string, unknown>,
  type: ResourceType,
): data is Record<string, unknown> & ItemData {
  if (type === 'condition') {
    return (
      hasExactFields(data, ['text', 'role', 'clinical_status', 'verification_status']) &&
      typeof data['text'] === 'string' &&
      ['principale', 'secondaria', 'anamnestica'].includes(String(data['role'])) &&
      ['active', 'resolved', 'unknown'].includes(String(data['clinical_status'])) &&
      ['confirmed', 'provisional', 'refuted'].includes(String(data['verification_status']))
    );
  }
  if (type === 'medication') {
    return (
      hasExactFields(data, ['name', 'dose', 'frequency', 'route', 'status', 'context']) &&
      typeof data['name'] === 'string' &&
      (typeof data['dose'] === 'string' || data['dose'] === null) &&
      (typeof data['frequency'] === 'string' || data['frequency'] === null) &&
      ['orale', 'endovenosa', 'sottocutanea', 'intramuscolare', 'inalatoria', 'transdermica', 'altro', null].some((value) => value === data['route']) &&
      ['active', 'stopped', 'intended', 'unknown'].includes(String(data['status'])) &&
      ['domiciliare_pre_ricovero', 'durante_ricovero', 'alla_dimissione'].includes(String(data['context']))
    );
  }
  return (
    hasExactFields(data, ['name', 'value_numeric', 'value_text', 'unit', 'timing', 'interpretation']) &&
    typeof data['name'] === 'string' &&
    ((typeof data['value_numeric'] === 'number' && Number.isFinite(data['value_numeric'])) || data['value_numeric'] === null) &&
    (typeof data['value_text'] === 'string' || data['value_text'] === null) &&
    (typeof data['unit'] === 'string' || data['unit'] === null) &&
    ['ingresso', 'durante_ricovero', 'dimissione', 'non_specificato'].includes(String(data['timing'])) &&
    ['alto', 'basso', 'normale', null].some((value) => value === data['interpretation'])
  );
}

@Component({
  selector: 'app-review',
  imports: [RouterLink],
  templateUrl: './review.component.html',
  styleUrl: './review.component.css',
})
export class ReviewComponent implements OnInit {
  private readonly api = inject(REVIEW_API);
  private readonly route = inject(ActivatedRoute);
  private letterId = '';

  protected readonly letterText = signal('');
  protected readonly letterTitle = signal('');
  protected readonly extraction = signal<Extraction | null>(null);
  protected readonly selectedId = signal('');
  protected readonly reviewer = signal('Medico revisore');
  protected readonly error = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly committed = signal(false);
  protected readonly commitResult = signal<{ bundle_id: string; saved_items: number } | null>(
    null,
  );
  protected readonly editOpen = signal(false);
  protected readonly rejectOpen = signal(false);
  protected readonly rejectReason = signal('');
  protected readonly editingData = signal<Record<string, unknown>>({});

  protected readonly items = computed(() => this.extraction()?.items ?? []);
  protected readonly groups = computed<ItemGroup[]>(() => {
    const items = this.items();
    return [
      { type: 'condition', title: 'Diagnosi', items: items.filter((item) => item.resource_type === 'condition') },
      { type: 'medication', title: 'Farmaci', items: items.filter((item) => item.resource_type === 'medication') },
      { type: 'observation', title: 'Esami di laboratorio', items: items.filter((item) => item.resource_type === 'observation') },
    ];
  });
  protected readonly selectedItem = computed(
    () => this.items().find((item) => item.item_id === this.selectedId()) ?? null,
  );
  protected readonly reviewed = computed(() => reviewedCount(this.items()));
  protected readonly mayCommit = computed(() => canCommit(this.items()) && !this.committed());
  protected readonly segments = computed(() =>
    splitEvidenceSegments(
      this.letterText(),
      this.items().map(({ item_id, evidence_span }) => ({
        itemId: item_id,
        span: evidence_span,
      })) satisfies EvidenceRange[],
    ),
  );
  protected readonly editFields = computed(() =>
    this.selectedItem() ? this.fieldsFor(this.selectedItem()!) : [],
  );

  ngOnInit(): void {
    this.letterId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.letterId) {
      this.error.set('Identificativo della lettera mancante.');
      this.loading.set(false);
      return;
    }
    void this.loadReview();
  }

  @HostListener('document:keydown', ['$event'])
  protected handleShortcut(event: KeyboardEvent): void {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    ) {
      return;
    }
    if (
      !this.selectedItem() ||
      this.loading() ||
      this.busy() ||
      this.editOpen() ||
      this.rejectOpen()
    ) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'a':
        event.preventDefault();
        void this.approveSelected();
        break;
      case 'm':
        event.preventDefault();
        this.openEdit();
        break;
      case 's':
        event.preventDefault();
        this.openReject();
        break;
      case 'j':
        event.preventDefault();
        this.moveSelection(1);
        break;
      case 'k':
        event.preventDefault();
        this.moveSelection(-1);
        break;
    }
  }

  protected selectItem(item: ReviewedItem): void {
    this.selectedId.set(item.item_id);
    const segmentIndex = this.segments().findIndex((segment) =>
      segment.itemIds.includes(item.item_id),
    );
    if (segmentIndex >= 0) {
      requestAnimationFrame(() => {
        document
          .getElementById(`evidence-${segmentIndex}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  protected selectSegment(segment: TextSegment): void {
    const item = this.items().find((candidate) => segment.itemIds.includes(candidate.item_id));
    if (item) this.selectItem(item);
  }

  protected segmentStatus(segment: TextSegment): ReviewedItem['review_status'] {
    const statusPriority: ReviewedItem['review_status'][] = [
      'pending',
      'rejected',
      'edited',
      'approved',
    ];
    const statuses = segment.itemIds
      .map((id) => this.items().find((item) => item.item_id === id)?.review_status)
      .filter((status): status is ReviewedItem['review_status'] => status !== undefined);
    return statusPriority.find((status) => statuses.includes(status)) ?? 'pending';
  }

  protected segmentBackground(segment: TextSegment): string | null {
    const colors = [
      ...new Set(
        segment.itemIds
          .map((id) => this.items().find((item) => item.item_id === id))
          .filter((item): item is ReviewedItem => item !== undefined)
          .map((item) => HIGHLIGHT_COLORS[item.review_status]),
      ),
    ];
    if (colors.length < 2) return null;
    const stops = colors.flatMap((color, index) => {
      const start = (index / colors.length) * 100;
      const end = ((index + 1) / colors.length) * 100;
      return [`${color}66 ${start}%`, `${color}66 ${end}%`];
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }

  protected displayDetails(item: ReviewedItem): string {
    const data = item.edited_data ?? item.data;
    if ('text' in data) {
      return `${data.text} · ${this.enumLabel(data.role)} · ${this.enumLabel(data.clinical_status)} · ${this.enumLabel(data.verification_status)}`;
    }
    if ('frequency' in data) {
      const parts = [data.name, data.dose, data.frequency, data.route, this.enumLabel(data.context), this.enumLabel(data.status)]
        .filter((part): part is string => part !== null && part !== '');
      return parts.join(', ');
    }
    const value =
      data.value_numeric !== null
        ? `${data.value_numeric}${data.unit ? ` ${data.unit}` : ''}`
        : data.value_text ?? 'Valore assente';
    return `${data.name}: ${value} · ${this.enumLabel(data.timing)}${data.interpretation ? ` · ${this.enumLabel(data.interpretation)}` : ''}`;
  }

  protected effectiveData(item: ReviewedItem): ItemData {
    return item.edited_data ?? item.data;
  }

  protected fieldValue(name: string): string {
    const value = this.editingData()[name];
    return value === null || value === undefined ? '' : String(value);
  }

  protected setEditField(field: EditField, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    const parsed: unknown =
      value === '' && (this.isNullable(field.name) || field.kind === 'number')
        ? null
        : field.kind === 'number'
          ? Number(value)
          : value;
    this.editingData.update((data) => ({ ...data, [field.name]: parsed }));
  }

  protected enumLabel(value: string | null): string {
    if (value === null) return 'Non specificato';
    return ENUM_LABELS[value] ?? value;
  }

  protected chooseItem(item: ReviewedItem): void {
    this.selectItem(item);
  }

  protected async approveSelected(): Promise<void> {
    const item = this.selectedItem();
    const extraction = this.extraction();
    if (!item || !extraction || this.committed()) return;
    await this.saveReview(item, {
      action: 'approve',
      reviewer: this.reviewer().trim(),
    });
  }

  protected openEdit(): void {
    const item = this.selectedItem();
    if (!item || this.committed()) return;
    this.editingData.set(Object.fromEntries(Object.entries(structuredClone(this.effectiveData(item)))));
    this.editOpen.set(true);
  }

  protected async saveEdit(): Promise<void> {
    const item = this.selectedItem();
    const extraction = this.extraction();
    if (!item || !extraction || this.committed()) return;
    const data = this.editingData();
    if (!data || !isItemData(data, item.resource_type)) {
      this.error.set('Controlla i campi: i valori non corrispondono allo schema di estrazione.');
      return;
    }
    if (!this.reviewer().trim()) {
      this.error.set('Inserisci il nome del revisore prima di registrare la decisione.');
      return;
    }
    this.editOpen.set(false);
    await this.saveReview(item, {
      action: 'edit',
      data,
      reviewer: this.reviewer().trim(),
    });
  }

  protected openReject(): void {
    if (!this.selectedItem() || this.committed()) return;
    this.rejectReason.set('');
    this.rejectOpen.set(true);
  }

  protected async confirmReject(): Promise<void> {
    const item = this.selectedItem();
    if (!item || this.committed()) return;
    this.rejectOpen.set(false);
    await this.saveReview(item, {
      action: 'reject',
      reason: this.rejectReason().trim() || undefined,
      reviewer: this.reviewer().trim(),
    });
  }

  protected async commit(): Promise<void> {
    const extraction = this.extraction();
    if (!extraction || !this.mayCommit() || this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    try {
      const result = await this.api.commitExtraction(extraction.id);
      this.commitResult.set(result);
      this.committed.set(true);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Impossibile salvare su FHIR.');
    } finally {
      this.busy.set(false);
    }
  }

  protected statusLabel(status: ReviewedItem['review_status']): string {
    return {
      pending: 'Da revisionare',
      approved: 'Approvato',
      edited: 'Modificato',
      rejected: 'Scartato',
    }[status];
  }

  protected updateReviewer(event: Event): void {
    this.reviewer.set((event.target as HTMLInputElement).value);
  }

  protected updateRejectReason(event: Event): void {
    this.rejectReason.set((event.target as HTMLTextAreaElement).value);
  }

  private async loadReview(): Promise<void> {
    try {
      const [letter, extraction] = await Promise.all([
        this.api.getLetter(this.letterId),
        this.api.extractLetter(this.letterId),
      ]);
      this.letterTitle.set(
        [...(await this.api.listLetters())].find((item) => item.id === this.letterId)?.title ??
          `Lettera ${letter.id}`,
      );
      this.letterText.set(letter.text);
      this.extraction.set(extraction);
      this.selectedId.set(extraction.items[0]?.item_id ?? '');
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Impossibile caricare la revisione.');
    } finally {
      this.loading.set(false);
    }
  }

  private async saveReview(
    item: ReviewedItem,
    request: {
      action: 'approve' | 'edit' | 'reject';
      data?: ItemData;
      reason?: string;
      reviewer: string;
    },
  ): Promise<void> {
    const extraction = this.extraction();
    if (!extraction || this.busy()) return;
    if (!request.reviewer) {
      this.error.set('Inserisci il nome del revisore prima di registrare la decisione.');
      return;
    }
    this.error.set('');
    this.busy.set(true);
    try {
      const updated = await this.api.reviewItem(extraction.id, item.item_id, request);
      this.extraction.update((current) =>
        current
          ? {
              ...current,
              items: current.items.map((candidate) =>
                candidate.item_id === updated.item_id ? updated : candidate,
              ),
            }
          : current,
      );
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Impossibile registrare la revisione.');
    } finally {
      this.busy.set(false);
    }
  }

  private moveSelection(direction: 1 | -1): void {
    const items = this.items();
    const currentIndex = items.findIndex((item) => item.item_id === this.selectedId());
    if (items.length === 0) return;
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    this.selectItem(items[nextIndex]);
  }

  private fieldsFor(item: ReviewedItem): EditField[] {
    const data = item.edited_data ?? item.data;
    return Object.keys(data).map((name) => ({
      name,
      label: FIELD_LABELS[name] ?? name,
      kind: ENUMS[name] ? 'select' : name === 'value_numeric' ? 'number' : 'text',
      options: ENUMS[name],
    }));
  }

  private isNullable(name: string): boolean {
    return ['dose', 'frequency', 'route', 'value_numeric', 'value_text', 'unit', 'interpretation'].includes(name);
  }
}
