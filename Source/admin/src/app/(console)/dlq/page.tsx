import { redirect } from 'next/navigation'

// The DLQ panel is now the Dead Letter Queue section of the Troubleshooting page.
export default function DlqRedirect() {
  redirect('/troubleshooting#dlq')
}
