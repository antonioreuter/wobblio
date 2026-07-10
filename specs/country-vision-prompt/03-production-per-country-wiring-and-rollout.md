# 03 — Production per-country wiring & rollout

**Goal.** Make the live ingestion worker select the country pack per receipt, instead of using the v9
monolith for everyone. This is the structural gate: until it lands, every pack authored in 00/02 is
dead in production.

Build after 01 (mechanism validated). **Do not roll out before 02** — otherwise a Brazilian receipt
gets `default` when `BR_PACK` exists.

## The problem to solve

`VisionParseService` is constructed **once** at worker cold start with a fixed `(promptTemplate,
promptVersion)` (`src/handlers/agentic-worker/index.ts:70-83`), but the country varies **per
message** (`ReceiptContext.countryCode`, resolved from `app_user.country_code` by
`ContributorContextRepositoryAdapter` → `ExtractionPreparer`). So the prompt must be chosen inside
`parse()`, per call — not fixed in the constructor.

## Approach (recommended): prompt selector, not per-country instances

Change `VisionParseService` to resolve the prompt per `parse()` from `ctx.countryCode`, keeping the
escalating/PDF wrappers untouched.

- Replace the constructor's `promptTemplate: string, promptVersion: string` with a selector:
  `resolvePrompt: (countryCode: string | undefined) => { template: string; version: string }`.
- In `parse()` / `buildRequest()`, call `resolvePrompt(ctx.countryCode)` and pass the resulting
  `template` as `systemPrompt` and `version` as `promptVersion`.
- Composition root wiring:
  - Primary + Sonnet fallback vision: `resolvePrompt = composeCountryVisionPrompt` (drop the
    `{template, version}` fields it doesn't need, or adapt the return).
  - PDF parser: keep the shared prompt — pass a constant selector
    `() => ({ template: VISION_PARSE_PROMPT, version: VISION_PARSE_PROMPT_VERSION })` (decision of
    record: packs are photo-receipt tuned; PDFs stay on v9 for now).
- The escalating fallback must compose with the **same** country as the primary (same `ctx`), so both
  arms report `v9c+<country>` — no change needed beyond both using the country selector.

Why not a per-country registry of `VisionParseService` instances: it forces per-country copies of the
escalating + PDF wrappers and a dispatch layer, for no benefit. The selector keeps one instance and
one wrapper chain.

**Hexagonal note.** `composeCountryVisionPrompt` is pure prompt code under `src/prompts` — passing it
as a callback into a core service keeps core free of infra. Run the validator (exit 0).

## Telemetry — already handled

`promptVersion` flows into `invoice_feedback.model_ids_snapshot` on every invocation (existing path).
After wiring, that value becomes `vision-parse/v9c+<country>`, giving a per-country A/B signal in
production for free. No new telemetry code. Note in the rollout that NL invoices flip
`v9 → v9c+nl` — this is why 01's no-regression gate exists.

## Tests

- Unit: extend `VisionParseService.test.ts` — a NL `ctx` yields the NL system prompt/version, a BR
  `ctx` yields BR, an unknown country yields default. Assert the selector is called with
  `ctx.countryCode` and the request carries the composed `version`.
- The existing `<user_country>` user-message assertion stays green (the user instruction is unchanged;
  only the system prompt is now country-composed).

## Rollout & verification (dev only — never prod, per project non-negotiable)

1. `npm run skill:hexagonal-architecture-validator` (exit 0), `npm run test:unit`.
2. Deploy the worker to **dev** (`WobblioDataAiPipelineStack-dev`).
3. End-to-end replay on the local/dev stack (`npm run replay -- <image>`), one NL and one BR receipt:
   - NL receipt → parses as before (no regression), telemetry shows `v9c+nl`.
   - BR receipt (a real cupom fiscal) → parses cleanly, tax/troco/CPF lines dropped, Σ = total,
     telemetry shows `v9c+br`.
4. Confirm in dev telemetry that `prompt_version` is now country-scoped.

## Acceptance / DoD

- [ ] `VisionParseService` selects the prompt per message from `ctx.countryCode`; primary + fallback
      country-composed, PDF on the shared prompt.
- [ ] Validator exit 0; unit tests (new selector cases + existing) green; 100% domain coverage held.
- [ ] Dev replay: NL unchanged, BR parses correctly, both report the country-scoped `prompt_version`.
- [ ] `00-handoff.md` updated: mark 03 done, note the `v9 → v9c+*` version transition and the dev
      verification result.
- [ ] Commit + push only when the user asks (trunk-based, direct to `main`).

## Follow-ups (out of scope, note in handoff)

- Cross-border case: pack keys on the *user's* country, not the receipt's — revisit if common.
- PDF country packs, if BR PDF invoices become material.
- Retiring the v9 monolith once `v9c+nl` is proven in production (keep both until then).
