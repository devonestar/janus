# Copilot Instructions — Janus

## What this project is

Janus is a CLI-first AI-native decision gate for PRD/spec markdown. The `janus` binary is the product; plugins/skills/hooks are optional adapters.

## Build & run

```bash
npm install
npm run build    # tsc -> ./dist
npm test         # mock-backend smoke test
npm run dev <args>  # tsx, skip build
```

## Code conventions

- ES module project (`"type": "module"` + NodeNext). All intra-`src/` imports use explicit `.js` extensions.
- Strict TypeScript. No `any` — use `unknown` + narrowing.
- `dist/` is tracked. After editing `src/`, run `npm run build` and commit `dist/` in the same change.
- Error handling: write human text to `stderr`, exit with typed code. Don't throw past the top-level try/catch.

## Key architecture

- `src/index.ts` — CLI entry (commander). Exit codes: 0=recommend, 1=conditional, 2=blocked, 3=error.
- `src/backend/` — one file per backend, all implement `JanusBackend` interface.
- `src/prompt/` — system prompts + output schema.
- `src/parser/output.ts` — validate + format output (json/markdown/yaml).
- `src/sampling/aggregator.ts` — `--samples N` consensus logic.
- `src/loop/engine.ts` — `janus loop` Generate-Evaluate-Eliminate-Refine.

## Principles (P1-P7)

Janus evaluates specs against seven principles. Keep references P1-P7 exactly as named in README.md. Do not rename or reorder them.

## What NOT to do

- Do not remove `delete process.env["CI"]` at `src/index.ts:3` — it is load-bearing for the claude backend.
- Do not add `reserved/` to `tsconfig.json` include — MCP is archived.
- Do not edit `integrations/skill/SKILL.md` description frontmatter casually — it triggers auto-invocation.
