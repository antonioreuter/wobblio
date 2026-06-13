import { auth } from '@/auth'
import { LeftNav } from '@/components/ui/left-nav'
import { TopBar } from '@/components/ui/top-bar'
import { RlsWarningBanner } from '@/components/ui/top-bar/rls-warning-banner'
import { SiteHeader } from '@/components/ui/site-header'
import { SiteFooter } from '@/components/ui/site-footer'
import { WorkspaceProvider } from '@/components/workspace'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userRole = session?.user?.role ?? 'STANDARD'
  const userEmail = session?.user?.email ?? 'AR'
  const userInitials = deriveInitials(userEmail)

  return (
    <>
      <SiteHeader variant="app" />
      <div className="workspace">
        <div className="app-shell" data-surface="calm">
          <LeftNav userRole={userRole} />
          <div className="app-body">
            <TopBar usageUsed={9} usageLimit={15} userInitials={userInitials} />
            <RlsWarningBanner />
            <WorkspaceProvider>{children}</WorkspaceProvider>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  )
}

function deriveInitials(input: string): string {
  const parts = input.trim().split(/[\s@.]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return input.slice(0, 2).toUpperCase()
}
