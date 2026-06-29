# 16a — Flutter Foundation & App Shell

**Mobile epic | Parent: [16 — Mobile Capture & Review](../16-mobile-capture-and-review.md) · Tracker: [16-00](./16-00-handoff.md)**

The first mobile slice: scaffold `Source/mobile/`, establish the hexagonal/BLoC skeleton, the
design-system theme, and the authenticated API client plumbing — so every later slice plugs into a
consistent structure. Ships an app that boots to a placeholder shell with green analyzer + tests.

## Dependencies

- None (first slice). Backend is consumed only from 16c onward.
- **Toolchain:** Flutter SDK installed by the developer; this slice assumes an FVM-pinned version
  (`.fvmrc` / `fvm_config.json`) but does not script the install.

## Scope

### Project scaffold
- `flutter create` under `Source/mobile/` (org `com.wobblio`, iOS + Android, deep-link scheme
  `wobblio://` registered for later auth/push slices).
- `pubspec.yaml` with: `flutter_bloc`, `equatable`, `get_it` (or `injectable`) for DI, `dio` or
  `http` for the API client, `freezed`/`json_serializable` for models. Pin the Flutter version via
  FVM. Keep dependency list lean (YAGNI — add capture/auth packages in their own slices).

### Architecture skeleton (per `flutter-architecture-guard.md`)
```
lib/
  core/            domain models, BLoCs, ports (abstract classes) — no native/SDK imports
    ports/         IApiClient, IAuthTokenProvider, (camera/storage/upload added later)
  infrastructure/  adapters implementing ports (concrete packages live here only)
  ui/              widgets/screens (no business logic)
  app.dart         root widget + theme + router
  main.dart        composition root: wire adapters → ports → BLoCs
```
- Domain/BLoCs **never** import from `infrastructure/` or concrete packages. Establish this as the
  rule the analyzer/lints guard.

### Design system (Obsidian Aurora parity)
- Port the theme tokens from the webapp `Source/webapp/src/styles/ds/tokens/colors.css` into a
  Flutter `ThemeData` (dark default `#161a24`/text `#f8fafc`/muted `#94a3b8`; primary indigo
  `#6366f1`; success teal `#0d9488`; warning amber `#f59e0b`; danger coral `#f43f5e`). Tabular
  figures for money. Light theme optional this slice.

### API client plumbing
- `IApiClient` port (typed GET/POST/PUT/DELETE + multipart) in `core/ports/`.
- An **`IAuthTokenProvider` port** — the client asks for a bearer token; it never reads secure
  storage or Cognito directly (16b supplies the real adapter; 16a ships a stub returning null).
- `API_BASE_URL` resolved per stage from build-time config (`--dart-define`), mirroring the
  webapp's stage-scoped base URL.

### Quality baseline
- `analysis_options.yaml` with `flutter_lints` + a custom rule/CI note enforcing the import
  boundary. One smoke widget test (app boots, shell renders).

## Reuse references
- Theme tokens: `Source/webapp/src/styles/ds/tokens/colors.css`.
- Backend base-URL/stage pattern: webapp `API_BASE_URL` handling (see memory `infra-gotchas`).

## Out of scope
- Auth (16b), camera/upload (16c), any screen beyond a placeholder shell.

## Checklist
- [x] `Source/mobile/` scaffolded; iOS + Android native folders generated; `wobblio://` scheme
      registered in `AndroidManifest.xml` + `Info.plist` (native folders gitignored, regenerated
      locally per README)
- [x] FVM-pinned Flutter version committed (`.fvmrc` → 3.44.4, matching the installed SDK)
- [x] `core/` / `infrastructure/` / `ui/` layout with import boundary enforced
      _(grep gate in README; verified clean: no `core/` import of `infrastructure/`/concrete pkgs)_
- [x] `IApiClient` + `IAuthTokenProvider` ports; stub token provider returns null
- [x] Obsidian-Aurora `ThemeData` (dark) matching webapp tokens
- [x] `API_BASE_URL` via `--dart-define`, per stage (`AppConfig.apiBaseUrl`)
- [x] `analysis_options.yaml` + one smoke widget test
- [x] `flutter analyze` clean (0 issues); `flutter test` green

## Verification
- `fvm flutter analyze` → 0 issues; `fvm flutter test` → green.
- App launches on iOS simulator + Android emulator to a themed placeholder shell.
- Grep confirms no `core/` file imports `infrastructure/` or a concrete package.
