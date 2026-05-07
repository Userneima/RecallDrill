# Guardrails

## Product Boundaries

Do not turn RecallDrill into a general knowledge base, file manager, or note editor.

The primary experience must remain:

```text
upload materials -> generate practice -> drill -> review weak points
```

Features that add organization, editing, or analytics must not make the drill loop harder to reach.

## Source Traceability

Every generated question must stay traceable to source material.

Do not remove or bypass these fields without replacing their function:

- `sourceExcerpt`
- `sourceLocation`
- `knowledgePointId`

Answer feedback must continue to show the answer, explanation, and original source evidence.

## Local-First Data Boundary

The current app persists data in browser `localStorage`.

Do not introduce backend persistence, authentication, sync, or remote storage as a side effect of unrelated work.

Changing `Material`, `MaterialDocument`, `KnowledgePoint`, `Question`, or `Attempt` can affect existing local data. Treat type changes as product data migrations, not cosmetic edits.

## AI Integration Boundary

The current generation engine is local and deterministic.

Do not put API keys or secrets in frontend code.

If real AI generation is added, it should replace or wrap the boundary currently represented by `src/lib/recallEngine.ts`; it should not rewrite the drill, wrong-book, or mastery loop unless there is a product reason.

## Import Boundary

Current file parsing behavior:

- PDF uses `pdfjs-dist`
- DOCX uses `mammoth`
- Plain text formats use `File.text()`

Multi-document import must preserve individual document names in source locations.

Do not collapse all source evidence into one anonymous text blob.

## Review And Mastery Boundary

Wrong and unfamiliar questions must remain reviewable.

Do not treat "answered once" as "mastered". Mastery is tied to repeated correct practice and wrong count.

The UI should continue to expose:

- Wrong book
- Re-practice wrong questions
- Weak knowledge points
- Mastery status

## UI Boundary

The UI should remain lightweight and direct.

Avoid:

- Landing-page hero sections
- Marketing-style feature pages
- Dense knowledge-base navigation
- Nested card-heavy layouts
- Explanatory onboarding text that replaces clear interaction design

## Verification Boundary

After behavior changes, run:

```bash
npm run lint
npm run build
npm run smoke
```

If a change touches only documentation, lint/build/smoke are not required unless the documentation references code behavior that needs confirmation.

## Agent Boundary

For context budget and search rules, follow `AGENTS.md`.

Do not read `node_modules`, `dist`, `tmp`, `.git`, or `package-lock.json` unless the task explicitly requires it.
