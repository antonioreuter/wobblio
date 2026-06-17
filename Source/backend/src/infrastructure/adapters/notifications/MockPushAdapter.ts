import type { IPushNotifier } from '@core/ports/notifications/IPushNotifier';

// Stand-in for SNS mobile push: the in-app notification store is the source of
// truth for this MVP. Real platform push (FCM/APNs) lands with the SNS plumbing.
export class MockPushAdapter implements IPushNotifier {
  async push(tenantId: string, title: string, body: string): Promise<void> {
    console.info(JSON.stringify({ event: 'mock_push', tenantId, title, body }));
  }
}
