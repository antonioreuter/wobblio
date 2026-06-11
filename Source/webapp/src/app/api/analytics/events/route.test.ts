import { POST } from './route';

describe('POST /api/analytics/events', () => {
  it('returns 200 for a valid event payload', async () => {
    const req = new Request('http://localhost/api/analytics/events', {
      method: 'POST',
      body: JSON.stringify({ event: 'hero_cta_click' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 when event field is missing', async () => {
    const req = new Request('http://localhost/api/analytics/events', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
