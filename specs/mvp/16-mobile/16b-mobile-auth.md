# 16b — Auth (Cognito on device)

**Mobile epic | Parent: [16](../16-mobile-capture-and-review.md) · Tracker: [16-00](./16-00-handoff.md)**

Authenticate the Flutter app against the existing Cognito mobile client, persist tokens securely,
refresh silently, and gate on the DB-canonical onboarding flag — so every later slice can make
authenticated backend calls.

## Dependencies
- [16a](./16a-mobile-foundation.md) (app shell, `IApiClient`, `IAuthTokenProvider` port)
- [04 — Authentication & Waitlist](../04-authentication-waitlist.md) (Cognito pool, `/me/profile`)
- Existing infra: `Source/infra/src/cdk/stacks/WobblioAuthStack.ts:170` — **mobile client already
  provisioned**: public (no secret), `userSrp: true` + auth-code grant, callbacks
  `wobblio://auth/callback` / `wobblio://auth/logout`. This slice is wiring, not new infra.

## Scope
- **Login** against the mobile client. Prefer the Hosted UI auth-code flow (PKCE) opened in a
  custom-tab/`ASWebAuthenticationSession`, returning via the `wobblio://auth/callback` deep link;
  SRP is available as a fallback. Federation (Google/Meta) is configured at the pool but not
  required on mobile for this slice.
- **Secure token storage as a port.** `ISecureTokenStore` in `core/ports/`; adapter backed by iOS
  Keychain / Android Keystore (`flutter_secure_storage`) in `infrastructure/`. Domain never touches
  the native store directly.
- **`IAuthTokenProvider` real adapter** (replacing the 16a stub): returns the current **ID token**
  for `Authorization: Bearer` (API Gateway authorizer expects the ID token — memory `infra-gotchas`).
- **Silent refresh**: refresh-token grant against the Cognito token endpoint before expiry; on
  refresh failure, force re-login (mirror the webapp's `ForceSignOut`/refresh-error handling).
- **Onboarding gate**: after sign-in, `GET /me/profile`; route to onboarding if `onboarded` is
  false. `onboarded` is **DB-canonical** (memory `onboarding-source-of-truth`) — never read from
  Cognito attributes (memory `no-cognito-profile-attrs`).
- **AuthBloc** owns session state (signed-out / authenticating / authed / onboarding-required) and
  drives the app router.

## Infra gap to close
- The **mobile client ID is not exported to SSM** (web client ID is, `WobblioAuthStack.ts:~214`).
  Add a stage-scoped SSM param/output for the mobile client ID + Hosted-UI domain so the app
  resolves them per stage via `--dart-define` or a bootstrap config call. Flag to the infra owner.

## Reuse references
- Token-refresh + profile-sync shape: `Source/webapp/src/auth.ts`.
- Onboarding gate semantics: memory `onboarding-source-of-truth`.

## Out of scope
- Capture/upload (16c); push-token registration (16g).

## Checklist
- [x] Hosted-UI auth-code (PKCE) login via `wobblio://auth/callback` (flutter_appauth behind
      `ICognitoAuthenticator`). SRP fallback **deferred** (Hosted-UI vs dev pool is the slice target).
- [x] `ISecureTokenStore` port + Keychain/Keystore adapter (`flutter_secure_storage`)
- [x] `IAuthTokenProvider` returns the ID token for Bearer auth (`CognitoAuthTokenProvider`)
- [x] Silent refresh (proactive, 60s skew) + force re-login on refresh failure
      (`onSessionExpired` → `AuthBloc` → signed out)
- [x] `GET /me/profile` onboarding gate; DB-canonical `onboarded` (`HttpProfileRepository`)
- [x] `AuthBloc` drives router (`AuthGate`: signed-out / authenticating / authed / onboarding-required)
- [x] Mobile client ID + Hosted-UI domain exported (CfnOutput + `--dart-define`, not SSM — see
      handoff). Code done; **infra owner deploys `WobblioAuthStack-<stage>`.**
- [x] Unit tests for AuthBloc transitions (mocked ports, `bloc_test`); `flutter analyze` clean
- [ ] **Manual dev-pool verification (device/simulator, infra owner)** — see Verification below

## Verification
- Login on the **dev** pool succeeds; ID token persisted and survives app restart (no re-login).
- An authed `GET /me/profile` returns the profile; expired access token triggers silent refresh.
- New user (no `onboarded_at`) is routed to onboarding; returning user lands on the dashboard.
