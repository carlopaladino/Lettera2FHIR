# Frontend

The review interface is a standalone Angular application for physicians. All example letters and extracted items are invented; use synthetic data only.

## Requirements

- Node.js supported by the Angular version in `package.json` (Node.js 22.22.3 or newer in the 22.x line, or 24.15.0 or newer in the 24.x line).
- npm.

## Install and run

From this directory:

```bash
npm install
npm start
```

Open `http://localhost:4200`. `npm start` uses the in-memory mock API by default. To run the unit tests once, use `npm test`; to create a production build, use `npm run build`.

## Switching between mock and real API

The application selects its API implementation using `useMock` in the Angular environment file:

- Local development (`npm start`): set `useMock` in `src/environments/environment.ts`.
- Production build (`npm run build`): set `useMock` in `src/environments/environment.prod.ts`.

It is `true` in both files by default. Set it to `false` to use `HttpApiService`. Configure `apiBaseUrl` in the same file to point at the backend, for example `http://localhost:8000`. The expected request and response shapes are documented in [`../docs/api-contract.md`](../docs/api-contract.md). The backend does not exist yet, so the real API mode requires a compatible service to be running.

## Project structure

```text
src/
├── app/
│   ├── core/       API models, API implementations, evidence segmentation, review state
│   ├── fixtures/   Invented Italian letters and their mock extraction results
│   ├── letters/    Letter-list screen
│   └── review/     Two-column review screen and review controls
├── environments/   Mock/real API setting and backend base URL
├── index.html      Browser page shell
└── styles.css      Global typography, colors, and keyboard focus styles
```

## Main screens and services

- `LetterListComponent` loads available letters from the API and links each one to its review page.
- `ReviewComponent` loads a letter and its extraction, segments and highlights evidence, groups items by resource type, handles keyboard shortcuts and review decisions, and enables commit only after every item is reviewed.
- `ApiService` describes the API operations. `MockApiService` returns synthetic in-memory data with a short delay and simulates review and commit. `HttpApiService` makes HTTP requests to the configured backend URL.
- `reviewApiProvider` chooses the mock or HTTP implementation from `environment.useMock`.
- `splitEvidenceSegments` splits the letter at evidence boundaries, including overlapping spans. `review-state.ts` contains the pure review-count, commit eligibility, and status-update functions.

Only synthetic data may be used in this application and repository.
