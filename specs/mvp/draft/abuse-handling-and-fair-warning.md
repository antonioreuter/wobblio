# Draft — Abuse Handling & Fair-Warning Escalation

**Status:** draft / parked. Not implemented in Epic 08. To be folded into the admin-console
epic (12). Captures the agreed escalation model for users who repeatedly submit faulty
invoices or attempt to poison the catalog / price index.

## Goal

Detect and stop catalog/price-index poisoning while being **fair and transparent** to the
user at every step. The user must always know their standing before any hard action.

## Detection (deterministic, continuous)

Ties into the deferred §6.8 anti-poisoning layers (statistical plausibility, nightly
trust-score cron, velocity limits, Sybil/collision flags). These deterministic signals do
the **continuous** gating — they run on every submission / nightly, with no LLM in the loop.
Signals: repeated faulty/low-confidence submissions, cross-tenant hash collisions, price
outliers vs. category bounds, abnormal submission velocity, Sybil-cluster correlation.

## Escalation ladder (fair, transparent)

1. **In-app warning each time** bad submissions are detected — explain what was wrong.
2. **Repeated warnings** → explicitly inform the user that continued bad practice will lead
   to a block. Never silent.
3. **Reversible enforcement:** IP block via **AWS WAF** (new infra). May be automated at
   high confidence in a later phase.
4. **Irreversible enforcement:** account deletion — **requires admin approval** (GDPR +
   irreversibility). Stays human-approved much longer than IP blocks.

## LLM-as-judge (advisory only, preselected cases)

The model does **not** process every event. Only when a user crosses the
**deletion-consideration threshold** does an evaluator run — **once, on that one case** — to
analyze it and produce a structured recommendation for the admin. This keeps cost trivial
(a handful of calls, not a stream) and places the model exactly where human judgment is
about to be applied.

- Reuse the existing **`auxiliary`** model role (SSM `/wobblio/config/models/auxiliary`,
  `IBedrockConverse` + `BedrockSpendGuardService`; Bedrock id `anthropic.claude-haiku-4-5`).
- Constrained JSON output `{ recommendation, confidence, summary, signals_cited }`,
  temperature 0, retry-once-on-schema-failure (reuse `callJsonWithRetry`).
- **Advisory only** — never the sole arbiter of a block or deletion.

## Admin console surface (Epic 12)

- Flagged/abusive users list with their warning history.
- The judge's recommendation + rationale + cited signals.
- Block (WAF) / delete (human-approved) actions, with audit trail.

## New infra implied

- AWS WAF IP-block rule set, wired to an admin action + (later) automated high-confidence path.
- A warning-history / standing store per tenant (extends `tenant_trust` / a new table).

## Dependencies

- §6.8 Layers 2–4 (deferred follow-up to Epic 08) must land first for the deterministic
  signals this builds on.
