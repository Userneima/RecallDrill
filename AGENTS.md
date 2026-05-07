# RecallDrill Agent Guide

Default language: Chinese. Code, commands, variables, and commit messages use English.

## Context Budget Rules

This repo can expand context quickly if searches include dependencies or generated files.

Always exclude these paths unless the task explicitly needs them:

```bash
node_modules
dist
tmp
.git
package-lock.json
```

Preferred discovery commands:

```bash
rg --files -g '!node_modules' -g '!dist' -g '!tmp' -g '!.git'
rg "<term>" src scripts docs README.md AGENTS.md
```

Do not read `package-lock.json` unless changing dependencies.
Do not inspect `node_modules` unless debugging a package integration.

## Project Map

Read [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) before broad code exploration.

For product handoff, read these files in order:

1. [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md)
2. [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)
3. [docs/GUARDRAILS.md](docs/GUARDRAILS.md)
4. [docs/LESSONS_LEARNED.md](docs/LESSONS_LEARNED.md)
5. [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md)

Main entry points:

- `src/App.tsx`: UI shell, app state, upload flow, drill flow, wrong book, mastery view
- `src/lib/recallEngine.ts`: material chunking, knowledge extraction, question generation, answer evaluation, review priority
- `src/types.ts`: shared data model
- `src/data.ts`: sample seed material
- `scripts/smoke.mjs`: Playwright smoke test

## Change Boundaries

- Preserve the current local-first behavior and browser `localStorage` persistence.
- Do not put API keys or secrets in frontend code.
- Keep every generated question traceable to `sourceExcerpt` and `sourceLocation`.
- Run `npm run lint`, `npm run build`, and relevant smoke tests after behavior changes.

## Known Context Risk

`src/App.tsx` is currently large and mixes view components with state orchestration. Prefer targeted reads by function name before reading the whole file.
