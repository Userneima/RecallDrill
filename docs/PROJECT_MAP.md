# Project Map

RecallDrill is a local-first React/Vite study tool. The core loop is:

```text
import documents -> extract knowledge points -> generate questions -> drill -> wrong book -> mastery update
```

For product-level handoff, read `docs/PRODUCT_BRIEF.md`, `docs/CURRENT_STATE.md`, `docs/GUARDRAILS.md`, and `docs/LESSONS_LEARNED.md` before diving into source files.

## Read By Task

- Upload, PDF, DOCX, multi-document import:
  - `src/App.tsx` functions `handleFiles`, `readDocumentFile`, `readPdf`, `readDocx`
  - `src/types.ts` `MaterialDocument`, `Material`

- Knowledge extraction, question generation, source traceability:
  - `src/lib/recallEngine.ts`
  - `src/types.ts`

- Drill, answer feedback, wrong questions, mastery:
  - `src/App.tsx` functions `submitAnswer`, `buildSession`, `getMaterialStats`
  - `src/lib/recallEngine.ts` functions `evaluateAnswer`, `updateKnowledgePoint`, `questionPriority`

- Visual layout:
  - `src/App.tsx` view components
  - `src/App.css`
  - `src/index.css`

- Verification:
  - `scripts/smoke.mjs`
  - `package.json` scripts

## Current Module Boundaries

- `src/App.tsx`: UI and orchestration. Large file; search for the exact function or component first.
- `src/lib/recallEngine.ts`: deterministic local generation engine. Real AI integration belongs behind this boundary.
- `src/types.ts`: product data contracts. Changing these affects persisted local data.
- `scripts/RecallDrillLauncher.applescript`: desktop app launcher for local dev server.

## Ignore During Normal Work

- `node_modules`: dependencies
- `dist`: build output
- `tmp`: smoke screenshots and generated test files
- `package-lock.json`: dependency lockfile; read only for dependency changes
