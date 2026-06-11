// DEPRECATED: Landing page moved to app/page.tsx.
// This file must remain to satisfy Next.js file conventions, but is superseded.
import { redirect } from 'next/navigation';

export default function MarketingRoot() {
  redirect('/');
}
