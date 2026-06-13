---
name: handoff
description: "Summarizes the current session's work and produces a compact structured brief for another model or agent to continue. Use when: handoff, continue in new session, pass to agent, summarize work done, session summary, pick up where left off."
---

# Handoff — Session Context Distillation

Gather current session state and emit a compact structured brief optimized for injection into another model or agent's context. Dense, no filler, under 600 tokens.

## Phase 1: Gather State

Run in parallel:

```bash
git diff HEAD --stat
git log --oneline -10
git status --short
```

Also read: CLAUDE.md, any open task lists, and the active spec file (`specs/mvp/`) if known.

## Phase 2: Produce the Handoff Brief

Output exactly this structure. No preamble, no sign-off.

```
## Handoff Brief — {YYYY-MM-DD HH:MM}

### What was built
{2-4 bullets. Specific: file names, function names, behaviors added.}

### Current state
- Branch: {branch name}
- Tests: {passing / failing / not run — name failing tests if any}
- Build: {clean / errors}
- Last commit: {hash + message}

### What's next
{2-4 bullets. Concrete next steps. Reference spec file path if applicable.}

### Blockers / open questions
{Unresolved decisions, missing info, or escalation points. "None" if clean.}

### Key files touched
{file path — one-line note on what changed, one per line}

### Context to carry forward
{Non-obvious decisions, discovered constraints, or patterns the next agent must know to avoid breaking things.}
```

## Rules

- Use exact file paths, function names, commit hashes — not approximations.
- If tests are failing, name the failing test explicitly.
- Cite the active spec by path (e.g., `specs/mvp/07-core-ingestion-pipeline.md`).
- Keep the entire brief under 600 tokens — cut ruthlessly.
