# Janus MCP Integration Guide (Archived)

This document is kept only as historical reference.

## Status

- MCP is **not** part of the current shipped Janus surface.
- The archived implementation lives at `reserved/mcp.ts`.
- The current public integration paths are documented in `README.md` and `integrations/README.md`.

## Do Not Use This File As Current Setup Documentation

The old MCP guide assumed a previously shipped `dist/mcp.js` artifact and older backend defaults. That is no longer true for the current public CLI.

If you want to use Janus today, use one of these instead:
- CLI directly via `janus eval|compare|gate|loop`
- Claude Code / OpenCode skill installation from `integrations/README.md`
- Git hook integration from `integrations/git-hook/pre-commit`

## Why This File Still Exists

It records that Janus previously experimented with an MCP surface and may revisit it later. If MCP is restored in the future, this file should be replaced by fresh docs generated from the actual shipped implementation rather than reused as-is.
