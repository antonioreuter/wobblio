# Fix 02 — Documentation Truth Realignment

**Priority: P4 (documentation drift — nothing here changes behavior, but every item below actively
misleads the next contributor/agent, and several were the seed findings of this audit).**
**Tag:** [DRIFT] · **DB migration:** none · **Code change:** none (docs only)

## Findings (each cited to the lying line)

1. **Root `CLAUDE.md`** — "Status: spec-complete (v2.4), implementation starting.
   `Source/backend/` and `Source/webapp/` are empty placeholders" and "(`Source/mobile/` will land
   later … the directory does not exist yet)". Reality: ~70 migrations, a full Lambda fleet, webapp,
   a separate admin app (`Source/admin/`, absent from the repository-layout block entirely), CDK in
   `Source/infra/`, and a Flutter app with 5+ shipped slices. The "Source of truth" section still
   crowns `docs/wobblio_v2.4_specification_final.md`; per this audit's charter, `specs/` +
   `Source/` are now canonical and the v2.4 doc is historical.
2. **`Source/backend/CLAUDE.md`** — "Status: scaffolding stage"; layout block claims `cdk/` and
   `migrations/` live under `backend/src` (both moved to `Source/infra/src/` — see memory/commit
   history and `feedback_infra_backend_separation`).
3. **`specs/mvp/README.md`** status table (lines 20–57): claims 07 is "⬜ Next" and 08–16 unstarted.
   Verified reality: 07/08/09 shipped; 10 shipped incl. the 10b/10c refactor (commit `9abb5bc1`);
   11a–11c shipped (`33a9c5ab`, `9702442e`; only 11d open); 12 shipped via `admin-console/00–08`
   (`119a26ef`); 15 shipped (same commit); 16a/16b/16f ✅ and 16c–16e 🚧 per `16-00-handoff.md`;
   **05 is marked ✅ Done but billing is a mock** (see 05a). Epics 17 and 18 are missing from the
   table entirely. The 12a–12g links point to `./12a-*.md` paths that moved to
   `./12-admin-console/` (every link dead). Hosting bullet (line 65) claims "Next.js static export
   (`output: 'export'`)" — the webapp is OpenNext SSR on Lambda (`Source/webapp/.open-next/`,
   deployment memory 2026-06-14).
4. **`specs/mvp/02b-deployment-hosting.md:9`** — "No server-side Next.js. The webapp is a pure
   static export." Same falsehood as above, in the spec that owns the subject.
5. **`.claude/rules/gdpr-privacy-officer.md`** — instructs initializing tenant context as
   `app.current_user_id`. The enforced GUC is `app.current_tenant_id`
   (`initial_schema.ts:358`, `TenantContextAdapter.ts:10`, root CLAUDE.md invariant #1). An agent
   following the rule literally would write policies that never match.
6. **`specs/mvp/10-budgets-shopping-lists-optimizer.md`** — index + README still say 10b/10c
   "refactor in progress"; the refactor scope (category lock, quantity, weblink sharing,
   store-exclusion) landed in `9abb5bc1` (2026-07-01). 10b's offline-support note still says
   "`Source/mobile/` does not exist yet".
7. **`specs/price-trends-revamp/00-handoff.md`** — "C+D NOT yet deployed" (2026-06-27); verify and
   update the deploy note.
8. **`specs/non-functional/00-implement-di.md`** — a raw prompt ("Act as a Principal TypeScript
   Engineer…") for a composition-root DI refactor that was never executed and contradicts the
   codebase's actual convention (positional constructor injection, wiring in handlers). Archive it
   to `specs/mvp/draft/` or delete; if manual DI is still wanted, it needs a real spec + decision.

## Proposed fix

One documentation pass, no code:
- Rewrite both CLAUDE.md status/layout sections to current reality; demote the v2.4 doc to
  "historical background" and name `specs/` + code as truth.
- Regenerate the README status table from `git log` + the handoff trackers (add 17, 18,
  non-functional, price-trends-revamp rows; fix 12a–12g link paths or drop them per
  `specs/mvp/admin-console/09-admin-spec-consolidation.md`); fix the hosting bullet and 02b.
- Fix the GUC name in the GDPR rule.
- Update 10-index/10b status markers; refresh price-trends deploy note; archive NF-00.

## Acceptance

A newcomer reading only CLAUDE.md + README reaches the same build-status conclusions this audit
did from git/code. No spec file claims static-export hosting or `app.current_user_id`.
