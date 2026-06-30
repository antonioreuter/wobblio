export type PushPlatform = 'FCM' | 'APNS';

export interface DeviceToken {
  id: string;
  platform: PushPlatform;
  token: string;
}

export interface IDeviceTokenRepository {
  // Register (or refresh) a device's push token. Idempotent on (tenant, platform, token);
  // re-registering clears any prior delivery error. Returns the row id.
  upsert(tenantId: string, platform: PushPlatform, token: string): Promise<string>;
  // The current tenant's registered tokens (RLS-scoped — caller sets the tenant context).
  listForTenant(): Promise<DeviceToken[]>;
  // Drop a token SNS rejected as permanently dead so it isn't retried.
  markDead(id: string): Promise<void>;
}
