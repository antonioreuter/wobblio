import { SiteHeader } from '@/components/ui/site-header'
import { SiteFooter } from '@/components/ui/site-footer'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader variant="auth" />
      {children}
      <SiteFooter />
    </>
  )
}
