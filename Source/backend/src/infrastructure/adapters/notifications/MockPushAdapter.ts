import type { IPushNotifier, PushData } from '@core/ports/notifications/IPushNotifier';

// Stand-in for SNS mobile push: the in-app notification store is the source of truth for
// this MVP. Real platform push (FCM/APNs) is SnsPushNotifierAdapter (16f); this remains
// the default where no device delivery is wanted (tests, local).
export class MockPushAdapter implements IPushNotifier {
  async push(tenantId: string, title: string, body: string, data?: PushData): Promise<void> {
    console.info(JSON.stringify({ event: 'mock_push', tenantId, title, body, data }));
  }
}
