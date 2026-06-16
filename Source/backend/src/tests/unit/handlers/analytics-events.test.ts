import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedObject } from 'vitest';
import { processAnalyticsEvent } from '@handlers/analytics-events/index';
import type { IAnalyticsQueuePort } from '@core/ports/notifications/IAnalyticsQueuePort';

describe('analytics-events handler', () => {
  let port: MockedObject<IAnalyticsQueuePort>;

  beforeEach(() => {
    port = { enqueue: vi.fn().mockResolvedValue(undefined) };
  });

  it('returns 200 and enqueues a valid event', async () => {
    const result = await processAnalyticsEvent(port, { event: 'hero_cta_click' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ ok: true });
    expect(port.enqueue).toHaveBeenCalledWith('hero_cta_click');
  });

  it('enqueues all valid funnel event types', async () => {
    const events = ['hero_cta_click', 'pricing_view', 'signup_start', 'signup_complete', 'waitlist_join'];
    for (const event of events) {
      port.enqueue.mockClear();
      const result = await processAnalyticsEvent(port, { event });
      expect(result.statusCode).toBe(200);
      expect(port.enqueue).toHaveBeenCalledWith(event);
    }
  });

  it('returns 400 and does not enqueue an unknown event', async () => {
    const result = await processAnalyticsEvent(port, { event: 'unknown_event' });
    expect(result.statusCode).toBe(400);
    expect(port.enqueue).not.toHaveBeenCalled();
  });

  it('returns 400 for null body', async () => {
    const result = await processAnalyticsEvent(port, null);
    expect(result.statusCode).toBe(400);
    expect(port.enqueue).not.toHaveBeenCalled();
  });

  it('returns 400 for missing event field', async () => {
    const result = await processAnalyticsEvent(port, {});
    expect(result.statusCode).toBe(400);
    expect(port.enqueue).not.toHaveBeenCalled();
  });
});
