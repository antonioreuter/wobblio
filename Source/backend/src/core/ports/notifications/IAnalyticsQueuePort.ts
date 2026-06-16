export type FunnelEvent =
  | 'hero_cta_click'
  | 'pricing_view'
  | 'signup_start'
  | 'signup_complete'
  | 'waitlist_join';

export interface IAnalyticsQueuePort {
  enqueue(event: FunnelEvent): Promise<void>;
}
