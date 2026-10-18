# Prompt: generazione lettere di dimissione sintetiche

Versione: `gen-v1`

## Come usarlo

1. Usa un modello diverso da quelli che valuterai (es. un modello cloud di fascia alta), per evitare che un modello venga testato su testi scritti da lui stesso.
2. Per ogni lettera sostituisci `{{SPECIALITA}}`, `{{COMPLESSITA}}` e `{{CARATTERISTICHE}}` con una riga del piano di generazione in fondo.
3. Salva la lettera in `data/synthetic/letter_XX.txt` e l'annotazione in `data/gold/letter_XX.draft.json`.
4. **L'annotazione generata è solo una bozza.** Correggila a mano confrontandola con la lettera, poi rinominala `letter_XX.json`. Senza questo passaggio le metriche non valgono nulla.

---

## Prompt

```
Sei un medico ospedaliero italiano con molti anni di esperienza. Scrivi una lettera di dimissione realistica e completamente inventata, da usare come dato sintetico per testare un sistema di estrazione automatica.

PARAMETRI
- Reparto: {{SPECIALITA}}
- Complessità: {{COMPLESSITA}}
- Caratteristiche obbligatorie da includere: {{CARATTERISTICHE}}

DATI FITTIZI
- Nessuna persona, struttura o medico reale. Usa nomi inventati e una struttura fittizia (es. "Presidio Ospedaliero di Valfiorita").
- Date nel 2026, coerenti tra loro (ingresso prima della dimissione).
- Non riprodurre casi clinici noti o pubblicati.

STRUTTURA DELLA LETTERA
Segui la struttura tipica di una lettera di dimissione italiana, con le sezioni che un medico userebbe davvero:
intestazione, motivo del ricovero, anamnesi patologica remota e prossima, terapia domiciliare, esame obiettivo all'ingresso, decorso clinico, esami ematochimici, esami strumentali, diagnosi di dimissione, terapia alla dimissione, indicazioni e follow-up.

STILE
- Scrivi come scrive un medico vero, non come un manuale: frasi brevi, abbreviazioni comuni (cp, die, bid, PA, FC, Hb, PCR, eGFR), qualche ripetizione.
- Alcuni valori di laboratorio in elenco, altri dentro il testo del decorso.
- Decimali con la virgola (es. "Hb 10,2 g/dl").
- Lunghezza: complessità bassa 300-400 parole, media 450-600, alta 650-850.

CARATTERISTICHE POSSIBILI (includi solo quelle richieste nei parametri)
- negazione: almeno una diagnosi esplicitamente esclusa ("si esclude", "negativo per")
- sospetto: almeno una diagnosi incerta ("sospetta", "verosimile", "da approfondire")
- sospensione: almeno un farmaco domiciliare sospeso o modificato durante il ricovero
- nuova_terapia: almeno un farmaco da iniziare dopo la dimissione
- nome_commerciale: farmaci citati sia con nome commerciale sia con principio attivo
- lab_ripetuti: lo stesso esame riportato all'ingresso e alla dimissione con valori diversi
- lab_in_prosa: valori di laboratorio scritti solo dentro il testo del decorso
- valori_qualitativi: risultati non numerici ("negativo", "nella norma", "debolmente positivo")
- refuso: uno o due errori di battitura realistici, non nei punti chiave

OUTPUT
Rispondi con due blocchi e nient'altro.

<lettera>
[testo completo della lettera]
</lettera>

<annotazione>
[un oggetto JSON conforme allo schema sotto]
</annotazione>

REGOLE PER L'ANNOTAZIONE
- Includi tutte le diagnosi (dimissione e anamnesi), tutti i farmaci (domiciliari, del ricovero, alla dimissione) e tutti gli esami di laboratorio. Escludi parametri vitali ed esami strumentali.
- Il campo "evidence" deve essere una sottostringa copiata carattere per carattere dalla lettera, con gli stessi errori di battitura e le stesse abbreviazioni.
- Le diagnosi escluse vanno incluse con verification_status "refuted".
- Se lo stesso farmaco compare in contesti diversi, crea una voce per ogni contesto.
- value_numeric con il punto come separatore decimale.

SCHEMA JSON
{{SCHEMA}}
```

Sostituisci `{{SCHEMA}}` con il contenuto di `schemas/extraction.schema.json`.

---

## Piano di generazione (30 lettere)

| # | Specialità | Complessità | Caratteristiche |
|---|---|---|---|
| 01 | Cardiologia | bassa | negazione, nome_commerciale |
| 02 | Cardiologia | media | sospensione, lab_ripetuti, nuova_terapia |
| 03 | Cardiologia | alta | sospetto, lab_in_prosa, nome_commerciale, refuso |
| 04 | Pneumologia | bassa | valori_qualitativi, nuova_terapia |
| 05 | Pneumologia | media | negazione, lab_ripetuti, sospensione |
| 06 | Pneumologia | alta | sospetto, lab_in_prosa, nome_commerciale, valori_qualitativi |
| 07 | Medicina interna | bassa | sospensione, refuso |
| 08 | Medicina interna | media | negazione, sospetto, lab_in_prosa |
| 09 | Medicina interna | alta | lab_ripetuti, nome_commerciale, nuova_terapia, sospensione |
| 10 | Geriatria | bassa | nome_commerciale, valori_qualitativi |
| 11 | Geriatria | media | sospensione, nuova_terapia, refuso |
| 12 | Geriatria | alta | negazione, sospetto, lab_ripetuti, lab_in_prosa |
| 13 | Chirurgia generale | bassa | nuova_terapia, lab_ripetuti |
| 14 | Chirurgia generale | media | negazione, valori_qualitativi, sospensione |
| 15 | Chirurgia generale | alta | sospetto, nome_commerciale, lab_in_prosa, refuso |
| 16 | Nefrologia | bassa | lab_ripetuti, negazione |
| 17 | Nefrologia | media | sospensione, lab_in_prosa, nome_commerciale |
| 18 | Nefrologia | alta | sospetto, nuova_terapia, valori_qualitativi, lab_ripetuti |
| 19 | Neurologia | bassa | sospetto, nuova_terapia |
| 20 | Neurologia | media | negazione, nome_commerciale, refuso |
| 21 | Neurologia | alta | sospensione, lab_in_prosa, valori_qualitativi, lab_ripetuti |
| 22 | Endocrinologia | bassa | lab_in_prosa, nome_commerciale |
| 23 | Endocrinologia | media | lab_ripetuti, nuova_terapia, sospensione |
| 24 | Endocrinologia | alta | negazione, sospetto, valori_qualitativi, refuso |
| 25 | Gastroenterologia | bassa | negazione, valori_qualitativi |
| 26 | Gastroenterologia | media | sospetto, lab_ripetuti, nome_commerciale |
| 27 | Gastroenterologia | alta | sospensione, nuova_terapia, lab_in_prosa, negazione |
| 28 | Ortopedia | bassa | nuova_terapia, refuso |
| 29 | Ortopedia | media | sospensione, lab_ripetuti, valori_qualitativi |
| 30 | Ortopedia | alta | negazione, sospetto, nome_commerciale, lab_in_prosa |

Le prime 15 lettere (01-15) diventano il set annotato a mano per la valutazione; le altre servono per sviluppare e migliorare il prompt di estrazione. Tieni separati i due gruppi: se ottimizzi il prompt guardando le lettere di valutazione, le metriche risultano gonfiate.
