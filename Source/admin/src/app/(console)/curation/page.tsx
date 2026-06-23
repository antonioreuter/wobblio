import { redirect } from 'next/navigation'

// Curation split into Product and Merchant queues; default to products.
export default function CurationRedirect() {
  redirect('/curation/products')
}
