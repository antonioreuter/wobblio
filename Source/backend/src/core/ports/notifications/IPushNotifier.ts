export interface IPushNotifier {
  // Best-effort device push. The in-app notification store is the source of truth;
  // a push failure must never fail the cron run.
  push(tenantId: string, title: string, body: string): Promise<void>;
}
