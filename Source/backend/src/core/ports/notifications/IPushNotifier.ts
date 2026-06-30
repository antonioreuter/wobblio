// Optional structured payload carried alongside the visible title/body so the mobile
// client (16g) can deep-link to the thing the push is about (e.g. a parsed invoice).
// `path` is the in-app route; `invoiceId` is present for ingestion-related pushes.
export interface PushData {
  type: string;
  path: string;
  invoiceId?: string;
}

export interface IPushNotifier {
  // Best-effort device push. The in-app notification store is the source of truth;
  // a push failure must never fail the caller (cron/worker). `data` is optional — the
  // existing notification callers send title/body only; ingestion pushes add a payload.
  push(tenantId: string, title: string, body: string, data?: PushData): Promise<void>;
}
