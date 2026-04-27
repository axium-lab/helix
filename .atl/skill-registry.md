# Skill Registry — helix-lib

Auto-resolved skills available in this project. Used by the SDD orchestrator to inject compact rules into sub-agent prompts.

**Generated**: 2026-04-27
**Project root**: `/Users/pedrolosas/workspace/fluxaria/helix-lib`

## Project Conventions

- `~/.claude/CLAUDE.md` — global user instructions (Agent Teams Lite orchestrator, SDD workflow, Engram protocol, personality rules).

No project-level `agents.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, or `copilot-instructions.md` files exist yet (greenfield project).

## User Skills

| Skill | Triggers | Path |
|-------|----------|------|
| branch-pr | Creating a pull request, opening a PR, preparing changes for review | `~/.claude/skills/branch-pr/SKILL.md` |
| flow | "flow", "genera flow", "documenta el flujo", "crea diagrama" for endpoint/module | `~/.claude/skills/flow/SKILL.md` |
| flow-info | "flow-info", "lista endpoints", "show endpoints", "qué endpoints hay" | `~/.claude/skills/flow-info/SKILL.md` |
| go-testing | Writing Go tests, teatest, Bubbletea TUI testing, Go coverage | `~/.claude/skills/go-testing/SKILL.md` |
| issue-creation | Creating a GitHub issue, reporting a bug, requesting a feature | `~/.claude/skills/issue-creation/SKILL.md` |
| judgment-day | "judgment day", "review adversarial", "dual review", "doble review", "juzgar" | `~/.claude/skills/judgment-day/SKILL.md` |
| skill-creator | Creating a new skill, adding agent instructions, documenting AI patterns | `~/.claude/skills/skill-creator/SKILL.md` |

## Compact Rules (auto-injectable)

The orchestrator should inject the relevant block(s) below into sub-agent prompts as `## Project Standards (auto-resolved)`.

### TypeScript Library (helix-lib)

- Architecture: Hexagonal / Ports & Adapters. Core ports define capabilities; provider-specific code lives in adapters.
- Output normalization: every LLM request function MUST return OpenAI Response format (PR1, PR5).
- Error normalization: every error MUST be a `HelixError` with a discriminated kind (PR6).
- Dependencies: prefer NO library. If needed, prefer the lightest one. NEVER LangChain (PR2).
- Tests: mandatory with openAI, openAI Azure, openAI custom, Google Vertex (PR3).
- Phase 1 compatibility: openAI, openAI azure, openAI custom (no files), Google Vertex (PR4).

### PR / Issue Workflows

- For PR creation, see `branch-pr` skill (issue-first enforcement).
- For issue creation, see `issue-creation` skill.

### Adversarial Review

- For dual blind reviews, invoke `judgment-day`.

## How the Orchestrator Uses This Registry

1. On session start (or after compaction): re-read this file and cache the **Compact Rules** section.
2. When delegating to a sub-agent, match relevant skills by code context (e.g., `*.ts` → TypeScript Library block) AND task context (e.g., "open a PR" → PR / Issue Workflows block).
3. Inject the matching compact rule blocks as `## Project Standards (auto-resolved)` at the top of the sub-agent prompt — BEFORE task instructions.
4. NEVER inject paths — inject the rule TEXT itself. Sub-agents do not read SKILL.md files.
