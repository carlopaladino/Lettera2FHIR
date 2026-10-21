# Contributing

## Ground rules

- **Use synthetic data only.** Never commit real patient documents, including anonymized or de-identified documents. All letters in `data/synthetic/` are invented.
- **Never commit secrets.** Put API keys only in `.env` (which is already in `.gitignore`); see `.env.example` for the variable names.
- **Keep the evaluation set separate.** Letters 01–15 (`data/synthetic/letter_01.txt` through `letter_15.txt` and their matching files in `data/gold/`) are the held-out evaluation set. If you work on extraction prompts, do not read or use these letters to improve prompts; develop prompts using only letters 16–30. People annotating letters 01–15 must not work on extraction prompts.
- **Version prompts.** Never edit an existing file in `prompts/`. Create a new file with a new version, such as `extract-v2.md`, so results remain reproducible.
- **Discuss gold annotation changes first.** Change `data/gold/letter_XX.json` only after discussion in an issue; these files are the reference for all metrics.

## How to contribute

Open or pick an issue first and comment that you are working on it. Fork the repository and create a branch named after the issue (for example, `12-angular-review-ui`). Open a pull request to `main` that links the issue. Keep pull requests small and focused on one issue.

## Development setup

The repository runs in GitHub Codespaces with the included devcontainer. Docker Compose is used for the HAPI FHIR server. Copy `.env.example` to `.env` and fill in the values, then install the backend dependencies with:

```bash
pip install -r backend/requirements.txt
```

## Code conventions

Use Python 3.12 and type hints. Tests are in `backend/tests`; run them with `pytest` and ensure they pass. Add tests for new functions. Write comments and documentation in English.

## For physicians

Clinical contributions—reviewing synthetic letters, annotating letters, and testing the review interface—do not require Git. You can comment on issues or contact the maintainer directly.

## Credit

All contributors are listed in the README and acknowledged in presentations or publications that come from the project.
