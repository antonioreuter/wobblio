# 01 — Validate decomposition: NL no-regression gate

**Goal.** Prove that splitting v9 into `base + NL_PACK` did not change the parse quality of the launch
market. This is the gate for the whole epic: if `vision-parse/v9c+nl` is worse than `vision-parse/v9`
on NL receipts, the production wiring (03) would regress every Dutch user.

**Why it can regress at all.** `NL_PACK` carries the v9 exclusion list and both worked examples
verbatim, but the composed prompt differs from v9 in two small ways: (a) one extra currency/date hint
line, and (b) whitespace/ordering around the injected slots. The model is sensitive to exactly this
kind of change (see the Jumbo multi-buy memory — byte-identical inputs, and separately, prompt tweaks
that did nothing). So measure, don't assume.

## Scope

- No code changes expected. This sub-spec is a measurement + a recorded verdict.
- If a regression appears, the fix is to bring `NL_PACK`'s slots closer to v9 (drop or reword the
  currency hint, match spacing) until parity holds — still no production change.

## Steps

1. Ensure the local Bedrock path works: `STAGE=local`, `AWS_PROFILE=reuterAdmin`, dev vision model
   from `config/local.env` (`MODEL_VISION_PARSER=qwen.qwen3-vl-235b-a22b`).
2. Run the harness across the NL fixtures (control = v9, candidate = `v9c+nl`):
   ```
   cd Source/backend && npm run eval:country-prompt
   ```
   (`jumbo_1`, `jumbo_2`, `ah_1` all resolve to country `NL` from truth/default.)
3. Read the per-fixture and summary blocks. The candidate's `checks passed` must be **≥** control's,
   fixture by fixture — not just in aggregate. Pay special attention to `jumbo_2` (the known
   quantity-misparse fixture): candidate must not newly break the total/Σ checks it passes today.
4. Because the vision model is non-deterministic on hard receipts, run **3 passes** and take the worst
   candidate result per fixture as the verdict (a single lucky pass is not parity).

## Acceptance / gate

- ✅ **Pass:** candidate ≥ control on every NL fixture across 3 runs → record the numbers in
  `00-handoff.md` (mark 01 done) and unblock 03.
- ❌ **Fail:** any NL fixture regresses → tighten `NL_PACK` slots toward v9 and re-run. Do not proceed
  to 03 until parity holds.

## Record in the handoff

A short table: fixture · control checks · candidate checks · token delta · verdict. This is the
evidence that promoting NL to the composed prompt is safe.

## Notes

- Token/cost deltas are expected to be ~0 (same model, near-identical prompt length). A large token
  delta means the slot injection changed the prompt more than intended — investigate before trusting
  the quality numbers.
- This sub-spec does **not** touch Brazil. It exists purely to de-risk the mechanism on the market we
  cannot afford to regress.
