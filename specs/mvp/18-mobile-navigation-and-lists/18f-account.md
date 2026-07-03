# 18f — Account

**Mobile epic | Parent: [18](../18-mobile-navigation-and-lists.md) · Tracker: [18-00](./18-00-handoff.md)**

New screen `ui/account/account_screen.dart`. Depends on `18a`. Also lands the Budgets-screen entry
point deferred by `18d` (Budgets shipped with no nav wiring).

## Backend contract

Only `GET /me/profile` exists (the onboarding-shaped read `HttpProfileRepository` already calls —
see `18a`/`AuthBloc`). No general profile-edit endpoint. `UserProfile` (`lib/core/auth/user_profile.dart`)
currently models exactly `{ onboarded, fullName, role, status }` — the backend returns more (country,
currency, …) but nothing else is parsed yet (reserved for `18e`'s `country`/`regionCode` extension).
**Account stays read-only in this slice and only renders fields `UserProfile` actually has** — no
country/currency/region row, since inventing fields the model doesn't carry would silently break the
moment someone actually extends `UserProfile` for `18e`.

## Resolved: email has no profile field — decode it from the ID token instead

`GET /me/profile` has no `email` field (correct — `UserProfile`'s only source of truth is DB-canonical
onboarding state, not Cognito). The Cognito ID token already held by `ISecureTokenStore` carries
`email` as a standard claim, so the DB round-trip is unnecessary. New pure function
`lib/core/auth/jwt_claims.dart`'s `decodeIdTokenClaims(String idToken)` base64url-decodes the JWT's
middle (payload) segment and JSON-decodes it — **no signature verification**, this is display-only
and the token has already been through Cognito auth to reach the app. JWT base64url segments
routinely omit the `=` padding standard base64 requires, so the segment is padded to a multiple of 4
before decoding. Never throws: a malformed token (wrong segment count, bad base64, non-JSON payload,
or a payload that isn't a JSON object) yields `{}`, so `claims['email'] as String?` is always safe.
`AccountBloc` treats a null/unrecoverable email the same as any other supplementary-but-not-blocking
signal — the screen still reaches `ready`, it just renders without an email line.

## Resolved: Budgets entry point lives here, not as a 6th bottom-nav tab

Per `18-00-handoff.md`'s user-confirmed scope decision, `OPTION 2A`'s nav caps at 5 slots once
Reports (`18e`) fills the reserved slot — Budgets was never going to be a tab. It's a row on this
screen instead, pushing `18d`'s already-built, previously-unwired `BudgetsScreen` (`const
BudgetsScreen()`, no constructor args).

## Scope

### `lib/core/auth/jwt_claims.dart`
`Map<String, dynamic> decodeIdTokenClaims(String idToken)` — pure function, no port/adapter needed
(it's not an I/O boundary, just parsing already-in-memory data), but kept as a clearly-named
standalone utility per the Flutter architecture guard rather than inlined into the bloc.

### `AccountBloc` (`lib/core/bloc/account/`)
- `AccountStatus { loading, ready, failure }` — no `empty` state (a signed-in session always has a
  profile).
- Single event `AccountStarted`: `IProfileRepository.fetchProfile()` and `ISecureTokenStore.read()`
  run concurrently via `Future.wait`; `email` is decoded from the resulting token bundle's `idToken`
  (`null` tokens, or a token with no `email` claim, both degrade to `email: null`, not a failure).
  Either future throwing (profile fetch failure or a token-store read error) is the only path to
  `failure`.
- **No sign-out event on this bloc.** Sign-out is dispatched directly from the screen against the
  app-wide `AuthBloc` (`context.read<AuthBloc>().add(const AuthLogoutRequested())`) — that bloc is
  provided at the root (`WobblioApp` in `app.dart`) and already owns the session lifecycle `AuthGate`
  reacts to; duplicating logout logic into a screen-scoped bloc would fork that ownership.

### `AccountScreen` (`lib/ui/account/account_screen.dart`)
- Header `GlassContainer`: `Avatar` (initials derived from `profile.fullName` — first+last word
  initial, or the single available initial, or `'?'` for an empty name) + name + email (omitted when
  null).
- Details `GlassContainer`: Plan (`WobblioBadge`, `STANDARD` → primary tone, any other role → success
  tone) and Status rows — the only two additional fields `UserProfile` actually carries.
- Budgets row: tappable `GlassContainer` pushing `BudgetsScreen` via `Navigator.push`.
- Destructive "Sign out" button (`WobblioButton`, `text` variant, danger foreground, mirrors Invoice
  Detail's delete button styling) with a confirm dialog mirroring
  `InvoiceDetailScreen._confirmDelete`'s pattern; confirming dispatches `AuthLogoutRequested`.

### Nav (`lib/ui/dashboard/dashboard_screen.dart`)
`AppBar.actions` gains a net-new `_AccountButton` (profile icon) alongside the existing `_UsagePill`
— not a relocation, there was no existing icon to move. Pushes `AccountScreen` via
`Navigator.push(MaterialPageRoute(...))`.

### DI (`lib/main.dart`)
`registerFactory<AccountBloc>` in a new "Account (18f)" block, depending on the already-registered
`IProfileRepository` and `ISecureTokenStore` — no new port/adapter.

## Out of scope

- Editable settings/theme/plan-switch (no backend endpoint — `GET /me/profile` is read-only).
- Country/currency/region rows (not modeled on `UserProfile` yet — `18e` extends it).
- Notification bell (`18g` adds its own nav action next to this one).

## Checklist

- [x] `lib/core/auth/jwt_claims.dart`: pure, non-throwing `decodeIdTokenClaims`
- [x] `AccountBloc`: concurrent profile + token fetch, decoded email, `loading/ready/failure`
- [x] `AccountScreen`: header, plan/status rows, Budgets row, sign-out with confirm dialog
- [x] `dashboard_screen.dart`: net-new `_AccountButton` in `AppBar.actions`
- [x] DI wiring in `main.dart` (18f block)
- [x] `fvm flutter analyze` → 0 issues; `fvm flutter test test/bloc/` → green (new
      `account_bloc_test.dart`); `fvm flutter test test/jwt_claims_test.dart` → green
