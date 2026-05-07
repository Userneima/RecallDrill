# Current State

## Implementation Status

RecallDrill is currently a local-first React/Vite MVP.

The app runs in the browser, stores study data in `localStorage`, and uses a deterministic local generation engine instead of a real LLM API. This keeps secrets out of frontend code and preserves the product loop while the AI backend is not yet integrated.

## Supported Import

Current import supports:

- Multiple files in one study set
- Pasted text merged with selected files
- TXT
- Markdown
- PDF through `pdfjs-dist`
- DOCX through `mammoth`
- Subtitle-like text files such as `.srt` and `.vtt`

Each parsed document is stored as a `MaterialDocument`. Source chunks preserve document title and paragraph location.

## Generated Study Data

The local engine in `src/lib/recallEngine.ts` creates:

- Source chunks
- Knowledge points
- Single-choice questions
- True/false questions
- Fill-in-the-blank questions for deep generation

Each question includes:

- `knowledgePointId`
- `answer`
- `explanation`
- `sourceExcerpt`
- `sourceLocation`

## Practice Flow

The UI supports:

- One-question-at-a-time drilling
- Option selection or blank answer input
- Submit
- Immediate feedback
- Correct answer display
- Explanation display
- Source evidence display
- Mark unfamiliar
- Next question

## Review And Mastery

Wrong or unfamiliar questions are tracked through fields on `Question`.

Knowledge point mastery uses four states:

```text
new -> weak -> familiar -> mastered
```

Current review priority is deterministic and based on:

- Wrong count
- Unfamiliar mark
- Knowledge point mastery state
- Whether the question was previously answered

## Main Files

- `src/App.tsx`: UI shell, state orchestration, document import, drill flow, wrong book, mastery view
- `src/lib/recallEngine.ts`: local extraction and question generation
- `src/types.ts`: shared data contracts
- `src/data.ts`: sample material
- `scripts/smoke.mjs`: browser smoke test
- `scripts/RecallDrillLauncher.applescript`: desktop launcher

For task-based file selection, read `docs/PROJECT_MAP.md`.

## Verification Status

The current validation path is:

```bash
npm run lint
npm run build
npm run smoke
```

`npm run smoke` verifies:

- Page load
- Multi-document upload with Markdown + DOCX
- DOCX parsed into the study set
- DOCX source location preserved
- Question rendering
- Answer submission
- Answer and source evidence display
- Wrong book navigation
- Mobile rendering

## Current Limitations

These are current facts, not a task list:

- The generation engine is deterministic local logic, not true AI generation.
- `src/App.tsx` is large and mixes orchestration with view components.
- `src/App.css` is large and contains all app styling.
- Browser data is local to the current browser profile.
- Existing persisted data may depend on the current `Material`, `Question`, and `KnowledgePoint` shapes.
