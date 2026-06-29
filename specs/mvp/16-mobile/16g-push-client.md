# 16g — Push Client

**Mobile epic | Parent: [16](../16-mobile-capture-and-review.md) · Tracker: [16-00](./16-00-handoff.md)**

The device side of push: register the FCM/APNs token with the backend, and route incoming push
taps to the right screen via deep links.

## Dependencies
- [16b](./16b-mobile-auth.md) (authed session to register the token)
- [16f](./16f-push-delivery-backend.md) (`POST /me/device-token`, SNS delivery, payload shape)

## Scope
- **Token registration**: obtain the platform token (FCM on Android, APNs on iOS), `POST
  /me/device-token { platform, token }` after login and again whenever the OS rotates the token.
  Re-register on refresh/login. Request notification permission with clear rationale.
- **Push as a port**: `IPushTokenProvider` / `IPushReceiver` in `core/ports/`; concrete
  `firebase_messaging` / APNs adapters in `infrastructure/`. Domain/BLoC never import the plugin.
- **Deep-link routing** (matches 16f payloads):
  - `PARSED` → invoice card (dashboard detail).
  - `NEEDS_REVIEW` → review screen (16e) for that `invoiceId`.
  - `FAILED_PROCESSING` → retry / contact-support affordance.
- Handle foreground, background, and cold-start (terminated) launches from a notification.

## Reuse references
- 16f payload contract (`type`, `invoiceId`, deep-link path).
- The app router established in 16a/16b for deep-link resolution.

## Out of scope
- Backend delivery/table/adapter (16f).

## Checklist
- [ ] Notification permission prompt with rationale
- [ ] FCM/APNs token obtained; `POST /me/device-token` on login + on OS token rotation
- [ ] Push behind `IPushTokenProvider` / `IPushReceiver` ports; plugins only in adapters
- [ ] Deep-link routing: PARSED → card, NEEDS_REVIEW → review (16e), FAILED → retry/support
- [ ] Foreground / background / cold-start handling
- [ ] BLoC/router unit tests (mocked ports); `flutter analyze` clean

## Verification
- After login, a `device_token` row exists server-side for the device.
- A test push of each type deep-links to the correct screen from foreground, background, and a
  terminated cold start.
- Token rotation re-registers without a duplicate row (upsert on `(tenant_id,platform,token)`).
