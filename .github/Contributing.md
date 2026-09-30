## Contributing to crewmatea350

Improvements are welcomed — report bugs, submit documentation fixes, add new flows, or contribute voice models.

This document explains how to get set up, which checks contributors should run locally, and the PR process.

**Quick links**
- [**Code of Conduct**](../CODE_OF_CONDUCT.md)
- [**License GPL-3.0**](../LICENSE)


---

## Getting started

Prerequisites

- Node.js (LTS recommended) and npm
- Tauri (see https://v2.tauri.app/start/)
- No .NET SDK: the speech engine comes prebuilt from [CrewMate-Voice](https://github.com/CrewMate-Flight-Sim/CrewMate-Voice), pinned in `voice.version`

Basic setup

```bash
git clone https://github.com/CrewMate-Flight-Sim/CrewMateA350.git
cd crewmatea350
npm install
```

Run the app in development

```bash
npm run tauri dev
```

The first run downloads the pinned speech engine (`npm run voice:fetch`, called automatically before dev and build). Run it once by hand before `cargo check` in a fresh clone, because the Tauri build needs the engine exe in `src-tauri/bin`.

Build a packaged app

```bash
npm run tauri build
```

Voice commands and training phrases

- Grammar: `voice/grammar.xml`. After changing discrete command ids or `src/voice/commandDispatch.ts`, run `python Scripts/validate-voice.py`.
- Training phrases: `voice/training_phrases.txt`.
- Engine changes (sidecar or trainer code) go to [CrewMate-Voice](https://github.com/CrewMate-Flight-Sim/CrewMate-Voice).

## Commands reference

- `format` — Run Prettier across the entire repo to apply formatting, then run `cargo fmt` to format Rust code in `src-tauri`.
- `format:check` — Run Prettier in check mode (fails if formatting is needed) and run `cargo fmt -- --check` to validate Rust formatting.
- `format:frontend` — Run Prettier only on frontend JavaScript/TypeScript files.
- `format:backend` — Run `cargo fmt` in `src-tauri` to format Rust sources.
- `lint` — Run frontend and backend linters by invoking `lint:frontend` and `lint:backend` sequentially.
- `lint:frontend` — Run ESLint over the frontend codebase to surface JS/TS lint issues.
- `lint:frontend:fix` — Run ESLint with `--fix` to automatically fix fixable frontend issues.
- `lint:backend` — Run `cargo clippy` for the Rust backend and treat warnings as errors (`-D warnings`).
- `check` — Run `format:check` then `lint` to validate formatting and linting in one step.

These scripts are defined in `package.json`; use them as shown above when preparing changes or opening a PR.

## Formatting & linting

Please run formatters and linters before pushing changes. Format and lint checks are expected on PRs.

```bash
npm run format
npm run check
```

## Where to contribute
- UI, components, hooks, stores: `src/`
- Flows: `src/data/flows/`
- Voice code: `src/voice/`
- Native/Tauri: `src-tauri/`
- Voice grammar and training phrases: `voice/`

## Pull Request process and checklist

- Fork the repository and create a branch for each change (e.g., `feat/my-feature`, `fix/typo`).
- Open a PR against `main` (or the default branch) with a clear title and description and link an issue when appropriate.

PR checklist

- [ ] Built and tested locally
- [ ] Updated documentation or flow examples when behavior changed
- [ ] Linked to the issue this PR addresses (if any)


## Security and sensitive data

Do not commit secrets or sensitive credentials (API keys, passwords, certificates) to the repository. Use environment variables or a secure secret store for any runtime secrets.

To report a security vulnerability or disclose sensitive issues privately, follow the instructions in https://github.com/CrewMate-Flight-Sim/CrewMateA350?tab=security-ov-file.

## Questions

Contributions are welcome!

Small improvements (for example, fixing a typo in a Markdown file) are appreciated and can be submitted directly as a PR. If you'd like guidance or prefer to discuss a change first, open an issue to ask a question.

Thanks for the help!
