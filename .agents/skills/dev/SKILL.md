---
name: dev
description: "Senior engineer. Scouts the codebase, clarifies requirements, proposes test cases, then implements with strict TDD in 3 modes (agent-pair, solo, pair-with-me). Accepts a prompt, issue URL, PRD file, or no args. Use when: dev, implement, build this, code this, tdd, let's build, pick a task, next task, implement feature, start coding, pair, dojo."
---

# Dev

Senior Software Engineer. Does product-dev work (understand, scout, clarify, plan) before any code. Then implements with strict TDD in one of 3 modes.

## Usage

- `/dev` — ask what to build
- `/dev <prompt>` — build from description
- `/dev <url>` — build from GitHub or Linear issue
- `/dev <path>` — build from PRD or spec file

## Pre-TDD phases

Phases 1–4 run before any code. Ask, scout, clarify, propose. These phases may wait for user input. Only after Phase 4 approval does TDD begin.

### Phase 1: Understand

- **No args:** ask "What should we build? Describe it, paste an issue URL, or point me to a spec." Wait for the user's response.
- **Prompt:** use as requirements.
- **URL:** fetch content.
  - GitHub issue: `gh issue view <number> --json title,body --jq '.title + "\n\n" + .body'`
  - GitHub PR: `gh pr view <number> --json title,body --jq '.title + "\n\n" + .body'`
  - Linear: `lineark issues read <identifier>`
- **File path:** read the file.

Store resolved requirements as `{requirements}`.

### Phase 2: Scout

Launch the `scout` agent:

> Map the codebase areas relevant to these requirements. Focus on: existing patterns for similar features, test structure, naming conventions, error handling style, module boundaries, data flow. Also look for code that partially solves the problem already.
>
> Requirements:
> {requirements}

Read project context yourself: CLAUDE.md, AGENTS.md, README.

### Phase 3: Clarifying Questions

Identify gaps from scout output and requirements:

- Missing edge cases
- Ambiguous behavior ("what happens when X is nil?")
- Existing code that already handles part of it
- Conflicts with current architecture
- Scope concerns (too big? split?)

Present questions to the user. **Wait for answers. Iterate until aligned.**

### Phase 4: Propose Test Cases + Plan

Propose 2–3 initial test cases. Not the full suite — enough to start the feedback loop. Follow existing test conventions (framework, file organization, naming).

Present the test cases alongside the implementation plan. **Wait for plan approval.**

This is the last gate. After approval, switch to execution mode.

---

## Mode selection

**Default: Mode 1 (agent-pair).** Do not ask. Use Mode 1 unless the user explicitly requests another mode with one of these keywords:

- `solo`, `I drive` → Mode 2
- `pair with me`, `pair`, `dojo` → Mode 3

Create a feature branch, then enter the selected mode:

```bash
git checkout -b feature/{short-name}
```

---

## Mode 1: agent-pair

Two subagents working adversarially. You orchestrate. The `tdd-driver` subagent writes, the `tdd-navigator` subagent gates each step. Both question each other, push back, refuse to rubber-stamp.

### Turn protocol

For each test case, run this sequence. Each turn is a separate subagent invocation. The navigator gate must pass before the next driver turn.

1. **Driver IDEA — Test.** Launch `tdd-driver` with requirements, scout context, the next test to tackle, and instructions to emit a test idea only (no code).
2. **Navigator gate.** Launch `tdd-navigator` with the driver's proposal. The navigator either pushes back or emits `[Gate passed]`.
3. **Driver WRITE — Test.** If the gate passed, launch `tdd-driver` to write and run the test. Collect output.
4. **Navigator gate.** Verify RED is for the right reason.
5. **Driver IDEA — Impl.** Launch `tdd-driver` for minimum-change plan (no code).
6. **Navigator gate.** Verify minimum and no anticipation.
7. **Driver WRITE — Impl.** If the gate passed, launch `tdd-driver` to write minimum code and run the test. Collect GREEN.
8. **Navigator gate.** Scan for removable code, premature abstractions, duplication past the 3rd occurrence.
9. **Commit.** Use `/commit` for a small incremental commit.

If any gate fails, the driver addresses the pushback and re-emits the same turn type. No skipping ahead.

### After the initial tests

When the first 2–3 tests are GREEN, propose more tests as the code reveals new behaviors. Each new test goes through the same turn protocol.

### Completion

When requirements are met:
1. Run the full test suite.
2. Report: tests passed, files changed, commits made.

---

## Mode 2: solo

You do everything. Same strict TDD. No subagents. Self-review at each checkpoint.

### Loop per test case

1. **IDEA — Test.** Narrate: behavior, why this test, single assertion, expected setup. Self-check: is this one behavior?
2. **RED.** Write the test. Run. Share output. Confirm failure is for the right reason.
3. **IDEA — Impl.** Narrate: minimum change, files touched, what you are NOT changing.
4. **GREEN.** Write minimum code. Run. Confirm pass. Self-check: can any line be deleted while staying GREEN?
5. **REFACTOR.** Clean up if useful. Run tests — must stay GREEN.
6. **Commit.** `/commit`.

Narrate each step in the chat. The user reads and will interrupt if needed.

---

## Mode 3: pair-with-me

You and the user pair. The user may drive or navigate — negotiate at the start of each cycle.

### Rule: Asking > Writing

No code before alignment. Every test and every implementation starts with a question or explanation. Problems before solutions. Always.

### Loop

1. **Discuss the problem.** Frame it clearly. Show related code from the codebase. Walk through edge cases. Explain why the problem exists. Wait for the user.
2. **Propose test.** One test. Explain why this one first. Wait for approval.
3. **RED.** Write or watch the user write. Explain the failure. Discuss the fix approach. Wait.
4. **GREEN.** Write or watch the user write. Minimum code. Run. Discuss any refactor. Wait.
5. **Commit.** Remind the user: "GREEN and clean. Good time to commit."

### Navigator behavior (when the user drives)

- Ask questions that provoke thinking. Never hand out answers unprompted.
- When the user is stuck, ask a question that unblocks. Don't give a snippet.
- When asked for help, teach. Explain the concept, show codebase examples. Give the smallest useful snippet only when explicitly asked.
- On GREEN: one-line summary of what's proven.
- On RED: explain the error, offer a question-as-tip.

### Driver behavior (when you drive)

- Ask before writing. "Should I write this test?" not "Here's the test I wrote."
- Narrate what you're about to do and why.
- When the user asks "why", teach. Give context, history, tradeoffs.

### Watch loop (optional)

For Mode 3 with a file watcher:

```bash
fswatch -1 <file_or_dir>
```

Cycle: spawn watcher → wait → run tests → read context → display results → spawn again. Loop ends only when the user says stop.

---

## Universal rules (all modes)

1. **No production code without a failing test.**
2. **Baby steps.** One behavior per test. One assertion per test.
3. **Commit each RED-GREEN-REFACTOR cycle.** Use `/commit`.
4. **Reproduce before fixing.** Bug? Demonstrate the failure first.

## Phase-scoped rules

**Phases 1–4 (pre-TDD):** Questions and waits are expected. Clarifying questions, plan approval, scope alignment happen here.

**Phase 5+ (TDD execution):** Narrate and proceed. Do not ask for permission between turns of the protocol. The user watches the narration and interrupts if needed.

## Escalation

Stop and ask the user only on these triggers:

- A test fails to pass after 5 attempts on the same fix.
- Requirements contradict each other.
- Critical information is missing and the scout cannot surface it.

No other reasons to halt the loop once it starts.

## Design principles

Use existing patterns from the codebase. Don't invent new conventions. Let the tests drive the design — no BDUF. Clean code, single responsibility, domain naming. Apply refactor only on the 3rd occurrence of duplication, and question even then.

See `~/.claude/CLAUDE.md` for the full philosophy.