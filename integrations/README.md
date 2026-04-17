# Janus Integrations (Non-MCP)

This directory contains the non-MCP integration surfaces for Janus. Janus recommended this path (Option G: Hybrid Skill + Git Hook) in Round 7 after the operator vetoed MCP.

## Layout

```
integrations/
├── skill/
│   └── SKILL.md        # Shared skill file for Claude Code + OpenCode
├── git-hook/
│   └── pre-commit      # Git pre-commit hook that runs `janus gate`
├── codex/
│   └── project-instructions.md  # Copy-paste snippet for Codex project instructions
└── README.md           # This file
```

## Install (15 minutes total)

### 1. Install the CLI

```bash
cd /path/to/janus
npm install
npm run build
# Option A: npm link to make janus globally available
npm link
# Option B: put the binary in your PATH manually
```

Verify:
```bash
command -v janus && janus --help | head -3
```

### 2. Install the skill

**For Claude Code**:
```bash
mkdir -p ~/.claude/skills/janus
cp integrations/skill/SKILL.md ~/.claude/skills/janus/SKILL.md
```

**For OpenCode**:
```bash
mkdir -p ~/.config/opencode/skills/janus
cp integrations/skill/SKILL.md ~/.config/opencode/skills/janus/SKILL.md
```

Both agents will auto-discover the skill on next session.

### 3. Install the git hook (per-repo)

In any git repo that contains PRD/spec docs:

```bash
cp /path/to/janus/integrations/git-hook/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Or, if you use Husky / lefthook, reference the file from your hook config.

The hook auto-detects changed files under `docs/specs/` or `docs/prds/` and blocks commits that fail `janus gate`. Override via `git commit --no-verify` when justified.

### 4. Configure Codex (prompt-level, no skill)

Codex has no skill convention. Paste the contents of `integrations/codex/project-instructions.md` into your project's `AGENTS.md` or equivalent project-instructions file.

## How The Two Layers Work Together

**Layer 1: Skill (agent-time)**
- Skill activates when the agent is about to finalize a spec/PRD
- Agent calls Janus during drafting and surfaces rejections/unknowns to the user
- The user sees risks BEFORE committing

**Layer 2: Git hook (commit-time)**
- Hook runs `janus gate` on changed spec files at commit
- If gate fails, commit is blocked
- Catches anything the agent missed during drafting

**Why both layers?**
- Skill is proactive but depends on agent judgment
- Hook is mechanical but happens after the fact
- Together they cover each other's misses

## Agents Supported

| Agent | Mechanism | Cold-start config time |
|-------|-----------|------------------------|
| Claude Code | Skill (`~/.claude/skills/janus/`) | < 5 min |
| OpenCode | Skill (`~/.config/opencode/skills/janus/`) | < 5 min |
| Codex CLI | Project instructions (`AGENTS.md` paste) | < 5 min |

All three use the same Janus CLI underneath. The skill and Codex snippet both tell the agent to call `janus gate <file>` or `janus eval <file>` via their existing Bash tool.

## Troubleshooting

**Agent doesn't invoke Janus**: check the skill is in the right directory and the `description` frontmatter field is present. Claude Code and OpenCode both trigger on the `description` field content.

**Hook blocks commits I don't want blocked**: narrow the `JANUS_WATCH_PATHS` regex or use `git commit --no-verify` for one-off bypass.

**"janus: binary not found"**: run `npm link` in the janus repo or add `janus/node_modules/.bin` to your PATH.
