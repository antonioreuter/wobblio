import { redirect } from 'next/navigation'

// Merged into the unified Platform Controls page (#models section).
export default function ModelsRedirect() {
  redirect('/platform#models')
}
