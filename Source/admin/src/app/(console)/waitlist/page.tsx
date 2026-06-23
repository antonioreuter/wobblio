import { redirect } from 'next/navigation'

// Merged into the unified Platform Controls page (#waitlist section).
export default function WaitlistRedirect() {
  redirect('/platform#waitlist')
}
