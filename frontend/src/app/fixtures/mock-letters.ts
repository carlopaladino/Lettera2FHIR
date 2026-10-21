import {
  Extraction,
  ItemData,
  Letter,
  ResourceType,
  ReviewedItem,
} from '../core/api.models';

interface MockLetter extends Letter {
  title: string;
  extraction: Extraction;
}

function item(
  letterText: string,
  itemId: string,
  resourceType: ResourceType,
  data: ItemData,
  evidence: string,
  spanMissing = false,
): ReviewedItem {
  const start = spanMissing ? -1 : letterText.indexOf(evidence);
  return {
    item_id: itemId,
    resource_type: resourceType,
    data,
    evidence,
    evidence_span: start < 0 ? null : { start, end: start + evidence.length },
    review_status: 'pending',
    edited_data: null,
    reject_reason: null,
  };
}

const cardiologyText = `Il signor Marco Bellini, 68 anni, è stato ricoverato dal 3 al 7 marzo per dispnea da sforzo e gonfiore alle caviglie, comparsi nell'ultima settimana. All'ingresso era vigile, collaborante e senza dolore toracico.
La radiografia ha mostrato congestione polmonare. L'ecocardiogramma ha evidenziato una ridotta funzione sistolica. Si conferma scompenso cardiaco acuto su cardiopatia ischemica nota. In anamnesi è riportata ipertensione arteriosa da circa dieci anni. Non si rilevano segni di infezione respiratoria e si esclude polmonite batterica.
Durante il ricovero è stato somministrato furosemide 40 mg per via endovenosa una volta al giorno, poi sospesa prima della dimissione. La terapia domiciliare con ramipril 5 mg, 1 compressa al mattino, è stata mantenuta. Alla dimissione si prescrive metoprololo 50 mg, 1 compressa due volte al giorno, per bocca.
Gli esami all'ingresso riportavano creatinina 1,3 mg/dL, lievemente aumentata. Alla dimissione l'emoglobina era 12,8 g/dL, nei limiti. Il sodio sierico è risultato 138 mmol/L durante il ricovero.
Il paziente torna al domicilio in condizioni stabili. Si raccomanda controllo cardiologico tra quattro settimane, monitoraggio del peso e accesso al medico curante in caso di peggioramento della dispnea.`;

const respiratoryText = `La signora Elena Riva, 54 anni, è stata ricoverata per tosse persistente e febbricola, con dimissione dopo tre giorni di osservazione. Non riferisce allergie farmacologiche note e non fuma.
Il tampone per influenza è risultato negativo. Si formula diagnosi di bronchite acuta, in miglioramento. Il reperto radiologico non mostra consolidamenti; si considera polmonite possibile ma da verificare solo se ricompare la febbre. È nota asma bronchiale intermittente, senza riacutizzazioni negli ultimi mesi.
Durante la degenza è stata usata soluzione fisiologica per aerosol, poi terminata. La paziente assumeva a casa salbutamolo spray al bisogno, terapia che può proseguire. Si prescrive amoxicillina 500 mg, una capsula ogni otto ore per cinque giorni, per via orale.
Gli esami di ingresso mostrano leucociti 9,2 10^9/L, valore normale. La proteina C reattiva è 18 mg/L, aumentata rispetto ai controlli precedenti. La saturazione misurata durante il ricovero è 97 per cento in aria ambiente.
Alla dimissione la paziente è apiretica, respira senza difficoltà e tollera l'alimentazione. È indicato un controllo dal medico di famiglia entro una settimana e una rivalutazione in caso di febbre persistente o difficoltà respiratoria.`;

function buildMockLetter(
  id: string,
  title: string,
  text: string,
  rows: Array<[ResourceType, ItemData, string, boolean?]>,
): MockLetter {
  const items = rows.map(([type, data, evidence, spanMissing], index) =>
    item(text, `${id}-item-${index + 1}`, type, data, evidence, spanMissing),
  );
  return {
    id,
    title,
    text,
    extraction: {
      id: `${id}-extraction`,
      letter_id: id,
      model: 'synthetic-demo',
      prompt_version: 'mock-v1',
      created_at: '2026-01-15T10:00:00.000Z',
      items,
    },
  };
}

export const MOCK_LETTERS: MockLetter[] = [
  buildMockLetter('letter-001', 'Dimissione cardiologica — Marco Bellini', cardiologyText, [
    [
      'condition',
      {
        text: 'Scompenso cardiaco acuto',
        role: 'principale',
        clinical_status: 'active',
        verification_status: 'confirmed',
      },
      'Si conferma scompenso cardiaco acuto su cardiopatia ischemica nota.',
    ],
    [
      'condition',
      {
        text: 'Cardiopatia ischemica',
        role: 'secondaria',
        clinical_status: 'active',
        verification_status: 'confirmed',
      },
      'Si conferma scompenso cardiaco acuto su cardiopatia ischemica nota.',
    ],
    [
      'condition',
      {
        text: 'Ipertensione arteriosa',
        role: 'anamnestica',
        clinical_status: 'active',
        verification_status: 'confirmed',
      },
      'In anamnesi è riportata ipertensione arteriosa da circa dieci anni.',
    ],
    [
      'condition',
      {
        text: 'Polmonite batterica',
        role: 'secondaria',
        clinical_status: 'resolved',
        verification_status: 'refuted',
      },
      'si esclude polmonite batterica',
    ],
    [
      'medication',
      {
        name: 'Furosemide',
        dose: '40 mg',
        frequency: 'una volta al giorno',
        route: 'endovenosa',
        status: 'stopped',
        context: 'durante_ricovero',
      },
      'Durante il ricovero è stato somministrato furosemide 40 mg per via endovenosa una volta al giorno, poi sospesa prima della dimissione.',
    ],
    [
      'medication',
      {
        name: 'Ramipril',
        dose: '5 mg',
        frequency: '1 compressa al mattino',
        route: 'orale',
        status: 'active',
        context: 'domiciliare_pre_ricovero',
      },
      'La terapia domiciliare con ramipril 5 mg, 1 compressa al mattino, è stata mantenuta.',
    ],
    [
      'medication',
      {
        name: 'Metoprololo',
        dose: '50 mg',
        frequency: '1 compressa due volte al giorno',
        route: 'orale',
        status: 'intended',
        context: 'alla_dimissione',
      },
      'Alla dimissione si prescrive metoprololo 50 mg, 1 compressa due volte al giorno, per bocca.',
    ],
    [
      'observation',
      {
        name: 'creatinina',
        value_numeric: 1.3,
        value_text: null,
        unit: 'mg/dL',
        timing: 'ingresso',
        interpretation: 'alto',
      },
      "Gli esami all'ingresso riportavano creatinina 1,3 mg/dL, lievemente aumentata.",
    ],
    [
      'observation',
      {
        name: 'emoglobina',
        value_numeric: 12.8,
        value_text: null,
        unit: 'g/dL',
        timing: 'dimissione',
        interpretation: 'normale',
      },
      "Alla dimissione l'emoglobina era 12,8 g/dL, nei limiti.",
    ],
    [
      'observation',
      {
        name: 'sodio sierico',
        value_numeric: 138,
        value_text: null,
        unit: 'mmol/L',
        timing: 'durante_ricovero',
        interpretation: null,
      },
      'Il sodio sierico è risultato 138 mmol/L durante il ricovero.',
    ],
  ]),
  buildMockLetter('letter-002', 'Dimissione pneumologica — Elena Riva', respiratoryText, [
    [
      'condition',
      {
        text: 'Bronchite acuta',
        role: 'principale',
        clinical_status: 'active',
        verification_status: 'confirmed',
      },
      'Si formula diagnosi di bronchite acuta, in miglioramento.',
    ],
    [
      'condition',
      {
        text: 'Polmonite',
        role: 'secondaria',
        clinical_status: 'unknown',
        verification_status: 'provisional',
      },
      'si considera polmonite possibile ma da verificare solo se ricompare la febbre',
    ],
    [
      'condition',
      {
        text: 'Asma bronchiale intermittente',
        role: 'anamnestica',
        clinical_status: 'active',
        verification_status: 'confirmed',
      },
      'È nota asma bronchiale intermittente, senza riacutizzazioni negli ultimi mesi.',
    ],
    [
      'condition',
      {
        text: 'Influenza',
        role: 'secondaria',
        clinical_status: 'resolved',
        verification_status: 'refuted',
      },
      'Il tampone per influenza è risultato negativo.',
    ],
    [
      'medication',
      {
        name: 'Soluzione fisiologica',
        dose: null,
        frequency: null,
        route: 'inalatoria',
        status: 'stopped',
        context: 'durante_ricovero',
      },
      'Durante la degenza è stata usata soluzione fisiologica per aerosol, poi terminata.',
    ],
    [
      'medication',
      {
        name: 'Salbutamolo',
        dose: null,
        frequency: 'al bisogno',
        route: 'inalatoria',
        status: 'active',
        context: 'domiciliare_pre_ricovero',
      },
      'La paziente assumeva a casa salbutamolo spray al bisogno, terapia che può proseguire.',
    ],
    [
      'medication',
      {
        name: 'Amoxicillina',
        dose: '500 mg',
        frequency: 'una capsula ogni otto ore per cinque giorni',
        route: 'orale',
        status: 'intended',
        context: 'alla_dimissione',
      },
      'Si prescrive amoxicillina 500 mg, una capsula ogni otto ore per cinque giorni, per via orale.',
    ],
    [
      'observation',
      {
        name: 'leucociti',
        value_numeric: 9.2,
        value_text: null,
        unit: '10^9/L',
        timing: 'ingresso',
        interpretation: 'normale',
      },
      'Gli esami di ingresso mostrano leucociti 9,2 10^9/L, valore normale.',
    ],
    [
      'observation',
      {
        name: 'proteina C reattiva',
        value_numeric: 18,
        value_text: null,
        unit: 'mg/L',
        timing: 'ingresso',
        interpretation: 'alto',
      },
      'La proteina C reattiva è 18 mg/L, aumentata rispetto ai controlli precedenti.',
    ],
    [
      'observation',
      {
        name: 'saturazione',
        value_numeric: 97,
        value_text: null,
        unit: 'per cento',
        timing: 'durante_ricovero',
        interpretation: null,
      },
      'Saturazione misurata durante il ricovero pari a 97 per cento in aria ambiente.',
      true,
    ],
  ]),
];
