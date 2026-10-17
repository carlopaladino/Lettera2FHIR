Lettera2FHIR

Turns Italian hospital discharge letters into validated HL7 FHIR resources, with a clinician reviewing every extracted item before it is saved.

Status: work in progress. Target for v1.0: December 2026. Not a medical device. Research and demonstration project, built and tested on synthetic data only.

Why

Much of the clinical information in Italian hospitals still lives in free text: discharge letters, reports, clinical diaries. The national Electronic Health Record (FSE 2.0) needs structured, interoperable data.

LLMs can bridge that gap, but in a hospital the hard questions are practical ones:

Can the data stay on-premise?
How do you catch the model when it makes something up?
Who is accountable for what ends up in the record?

Lettera2FHIR is a small, end-to-end answer to those questions.

What it does
Extract. A locally hosted LLM reads the letter and extracts diagnoses, medications and lab results as structured JSON. Every item must quote the sentence it comes from.
Check evidence. Items whose quote cannot be found verbatim in the letter are flagged as possible hallucinations.
Map to FHIR. Extracted items become FHIR R4 resources (Condition, MedicationStatement, Observation) in a Bundle, validated against a HAPI FHIR server.
Review. A web interface shows the letter with highlighted evidence next to the extracted items. The clinician approves, edits or rejects each one.
Audit. Every decision is logged: who, when, which model, which prompt version, original value and correction.
Evaluate. A script measures precision and recall against hand-annotated letters, per resource type and per model.
Architecture
approved
Discharge letter(Italian free text)
APIFastAPI
LLMOllama, structured output
Evidence check
FHIR mapping
HAPI FHIR$validate
Review UIAngular
HAPI FHIR server
Audit log
Component	Technology
Backend	Python, FastAPI, Pydantic, fhir.resources
LLM	Ollama with open-weight models (local by default, cloud provider configurable)
FHIR server	HAPI FHIR (Docker)
Frontend	Angular
Deployment	Docker Compose
Quickstart
bash
git clone https://github.com/carlopaladino/lettera2fhir.git
cd lettera2fhir
cp .env.example .env
docker compose up -d
docker compose exec ollama ollama pull <model-name>

Then open http://localhost:4200.

Project structure
lettera2fhir/
├── backend/            # FastAPI app: extraction, evidence check, FHIR mapping, audit
├── frontend/           # Angular review interface
├── schemas/            # JSON Schema for the LLM output
├── prompts/            # Extraction and synthetic data prompts, versioned
├── data/
│   ├── synthetic/      # Synthetic discharge letters
│   └── gold/           # Hand-verified annotations
├── eval/               # Evaluation scripts and results
└── docker-compose.yml
Data

All letters are synthetic, generated with an LLM across ten specialties and three levels of complexity, then annotated and verified by hand. They are written to include the things that make real letters difficult: negations ("si esclude"), abbreviations, brand-name drugs, suspended therapies, lab values written in prose.

Synthetic letters are generated with a different model from the ones being evaluated, to avoid a model being tested on its own writing.

No real patient data is used anywhere in this repository.

Evaluation

Results will be published here as the project progresses.

Model	Conditions F1	Medications F1	Observations F1	Ungrounded items
—	—	—	—	—

"Ungrounded items" is the share of extracted items whose evidence quote does not appear in the source text.

Limitations
Synthetic data only: performance on real clinical text will differ.
No clinical coding yet (ICD-9-CM, ICD-10, LOINC, ATC).
Three resource types only.
Single-document context: no linking to previous encounters.
Roadmap
 Extraction pipeline with evidence check
 FHIR mapping and validation
 Evaluation on hand-annotated set
 Review interface
 Audit log
 Clinical coding suggestions (ICD-9-CM / LOINC), always marked for review
 Support for other document types (lab and imaging reports)
Author

Carlo Paladino, data engineer working with clinical data. Member of SIIAM, the Italian Society of AI in Medicine.

LinkedIn

License

Apache-2.0
