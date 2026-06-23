import { redirect } from 'next/navigation'

// Merged into the unified Platform Controls page (#config section).
export default function ConfigRedirect() {
  redirect('/platform#config')
}
