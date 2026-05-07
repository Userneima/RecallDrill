# 刷记 / RecallDrill

RecallDrill is a lightweight study drilling tool. It turns learning materials into traceable knowledge points and quiz questions, then uses practice, wrong-question review, and mastery status to form a memory loop.

## MVP Scope

- Upload multiple TXT, Markdown, PDF, DOCX, subtitle, or note documents into one study set
- Extract knowledge points by topic, importance, difficulty, and source excerpt
- Generate single-choice, true/false, and fill-in-the-blank questions
- Drill one question at a time with immediate answer feedback
- Show explanation and original source evidence for every question
- Collect wrong or unfamiliar questions automatically
- Re-practice wrong questions and weak knowledge points
- Track mastery as 未练, 薄弱, 熟悉, 掌握
- Persist data locally in the browser

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Verification

```bash
npm run lint
npm run build
npm run smoke
```

`npm run smoke` uses Playwright to verify page load, drill feedback, source evidence, wrong-question navigation, and mobile rendering.

## Architecture

The first version keeps the app local and avoids storing secrets in frontend code.

- `src/lib/recallEngine.ts`: local material chunking, knowledge-point extraction, question generation, answer evaluation, and review priority
- `src/App.tsx`: app state, local persistence, material upload, drill flow, wrong book, and mastery views
- `src/types.ts`: shared product data model
- `scripts/smoke.mjs`: browser smoke test

Future real AI integration should replace the generation engine behind the same data contract instead of rewriting the drill and review loop.
