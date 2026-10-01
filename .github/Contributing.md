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
- The MSFS SDK, with `MSFS_SDK` set to its folder (for example `C:\MSFS 2024 SDK`), and LLVM (`winget install LLVM.LLVM`) with `LIBCLANG_PATH` set to its `bin` folder. The SimConnect crate links the SDK and generates its bindings with libclang.
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
npm run tauri build -- --no-sign
```

This builds an unsigned MSI in `src-tauri/target/release/bundle/msi/` for testing on your own machine. Without `--no-sign` the build fails at the end, because it signs the updater files with a key only the repo owners have; release builds are made by the owners through the publish workflow.

Backend code and CrewMate-Core

Most of the Rust backend (audio, speech bridge, push-to-talk input, SimConnect, logging, the app shell) lives in [CrewMate-Core](https://github.com/CrewMate-Flight-Sim/CrewMate-Core), shared by every CrewMate aircraft app and pinned by tag in `src-tauri/Cargo.toml`. This repo's `src-tauri/src` keeps only what is this app's own: its `Config` and its windows. A fix to shared backend logic is made in CrewMate-Core, never here; see its Contributing guide.

To test a CrewMate-Core change in this app, clone CrewMate-Core next to this repo and create `src-tauri/.cargo/config.toml` (gitignored):

```toml
[patch."https://github.com/CrewMate-Flight-Sim/CrewMate-Core"]
crewmate-core = { path = "../../CrewMate-Core/crates/crewmate-core" }
```

`npm run tauri dev` then builds against your checkout. While the file exists, `src-tauri/Cargo.lock` points at your local path, so don't commit it in that state. Delete the file afterwards; the next build puts the lock back on the pinned tag. Never ship a build made that way.

Updating the CrewMate-Core version (repo owners)

1. Read the [CrewMate-Core changelog](https://github.com/CrewMate-Flight-Sim/CrewMate-Core/blob/main/CHANGELOG.md) between the pinned tag and the new one. A new major version can need changes here.
2. Change `tag` on the `crewmate-core` line in `src-tauri/Cargo.toml`.
3. In `src-tauri`, run `cargo check`. It fetches the new tag and updates `Cargo.lock`.
4. Run `npm run check` and `npm run tauri dev`, and exercise what the new version changed.
5. Commit `Cargo.toml` and `Cargo.lock`, and ship it in a normal release, after installing a build over the current public release.

Voice commands and training phrases

- Grammar: `voice/grammar.xml`. After changing discrete command ids or `src/voice/commandDispatch.ts`, run `python Scripts/validate-voice.py`.
- Training phrases: `voice/training_phrases.txt`.
- Engine changes (sidecar or trainer code) go to [CrewMate-Voice](https://github.com/CrewMate-Flight-Sim/CrewMate-Voice); see its Contributing guide.

Updating the voice engine version

The engine version this app uses is pinned in `voice.version`. To move to a newer [CrewMate-Voice release](https://github.com/CrewMate-Flight-Sim/CrewMate-Voice/releases):

1. Read that release's changelog entry. A new major version can need grammar or code changes here.
2. Put the new version in `voice.version` (for example `1.1.0`, without the `v`).
3. Run `npm run voice:fetch`. It downloads the engine into `.voice-cache/`, checks it against the release's `SHA256SUMS` and deploys it to `src-tauri/bin` and `src-tauri/Trainer`.
4. Run `npm run tauri dev`. The log shows `[Speech] Engine <version>, protocol <n>`. Speak a few commands and open the voice trainer from `src-tauri/Trainer` once.
5. Commit `voice.version` (the engine files themselves are gitignored) and ship it in a normal release, after installing a build over the current public release and checking that voice commands and the trainer work.

To try an engine build that isn't released yet, build it in CrewMate-Voice and set `CREWMATE_VOICE_DIST` to its `dist/` folder before `npm run tauri dev`. Remove the variable afterwards; never ship a build made that way.

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
- Native/Tauri: this app's config and windows in `src-tauri/`; shared backend logic in [CrewMate-Core](https://github.com/CrewMate-Flight-Sim/CrewMate-Core)
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
