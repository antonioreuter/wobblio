import { NextResponse } from 'next/server';

const VALID_EVENTS = new Set([
  'hero_cta_click',
  'pricing_view',
  'signup_start',
  'signup_complete',
  'waitlist_join',
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.event || !VALID_EVENTS.has(body.event)) {
    return NextResponse.json({ error: 'invalid event' }, { status: 400 });
  }
  console.log(JSON.stringify({ type: 'funnel_event', event: body.event, ts: Date.now() }));
  return NextResponse.json({ ok: true });
}
