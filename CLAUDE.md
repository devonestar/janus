# CLAUDE.md — Janus (Project-Level)

## Project identity

Janus is a CLI-first AI-native decision gate for PRD/spec markdown. The `janus` binary is the product. Everything else (plugins, skills, hooks) is an optional adapter.

## Build commands

```bash
npm install
npm run build          # tsc -> ./dist (the only typecheck)
npm test               # mock-backend smoke: fixtures/smoke.md
npm run dev <args>     # tsx src/index.ts (skip build)
npm run check:intake -- <file.md>   # markdown structure gate
npm run self-dev -- <file.md> [backend]   # full self-dev pipeline
```

## Rules for editing this repo

1. **dist/ is tracked.** After any `src/` edit, run `npm run build` and commit `dist/` together.
2. **Strict TS, no `any`.** Use `unknown` + narrowing for error handling.
3. **ES modules.** All imports use explicit `.js` extensions (NodeNext convention).
4. **Do not remove** `delete process.env["CI"]` at `src/index.ts:3` — load-bearing for claude backend.
5. **Do not add** `reserved/` to tsconfig include — MCP is archived.
6. **Principle refs P1-P7** must match README.md exactly. Do not rename or reorder.
7. **SKILL.md description frontmatter** triggers auto-invocation in Claude Code / OpenCode — edit with care.

## Exit codes

- 0 = recommend
- 1 = conditional
- 2 = blocked
- 3 = error

## When to run Janus on your own changes

Spec-level changes (`specs/`, large README edits) must be evaluated with `janus eval` or `janus loop` before committing. Code-only `src/` changes are not gated.

## CI

GitHub Actions runs on push/PR to main: build + test across Node 18/20/22 + dist/ freshness check.
