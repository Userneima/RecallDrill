# Lessons Learned

## Context Can Blow Up From Search

`node_modules` is the largest practical context risk in this repo.

Earlier broad file discovery produced massive output because dependencies were included. Start investigation from `AGENTS.md` and `docs/PROJECT_MAP.md`, then use scoped `rg` commands.

## The Product Loop Matters More Than Quantity

The product is not valuable because it generates many questions. It is valuable when questions become repeatable memory checks.

Any generation change should preserve:

- Source evidence
- Immediate feedback
- Wrong-question review
- Mastery update

## Local Generation Is A Temporary Boundary, Not The Product Goal

The current engine in `src/lib/recallEngine.ts` proves the workflow without needing a model API.

This is useful because the drill UI, review state, and source-tracing data contract can be built and tested before real AI generation is connected.

## Do Not Put Secrets In The Frontend

Real AI generation should not be added by placing API keys in React code or browser-visible environment variables.

The current frontend-only engine avoids this risk by design.

## DOCX Import Works Through Mammoth

DOCX support is implemented with `mammoth.extractRawText`.

The smoke test creates a minimal DOCX and verifies that:

- It is parsed into the study set
- The document kind is `docx`
- Source location includes the DOCX file name

## PDF Import Requires A Worker

PDF import uses `pdfjs-dist` and sets `GlobalWorkerOptions.workerSrc`.

Removing or changing the worker setup can break browser PDF parsing even if TypeScript still builds.

## Browser Plugin Was Not Reliable In This Environment

The Codex in-app browser backend was not discoverable during verification.

Playwright was used as the reliable fallback, and `scripts/smoke.mjs` now captures the core browser flow.

## Template Residue Should Be Removed Early

Vite starter assets can mislead readers into inspecting unused files.

Unused template assets were removed, and generated smoke screenshots are kept under `tmp`, which is ignored for normal work.

## App.tsx Is The Main Structural Risk

`src/App.tsx` currently holds state orchestration, file parsing, selectors, and view components.

For small changes, search by exact function name instead of reading the whole file. Broad refactors should preserve behavior first and use smoke verification.
