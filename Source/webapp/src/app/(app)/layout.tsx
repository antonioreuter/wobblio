import { auth } from '@/auth'
import { AuthSessionProvider } from '@/components/providers/auth-session-provider'
import { SessionTimeoutGuard } from '@/components/auth/session-timeout-guard'
import { LeftNav, LeftNavDrawer, NavDrawerProvider } from '@/components/ui/left-nav'
import { TopBar } from '@/components/ui/top-bar'
import { RlsWarningBanner } from '@/components/ui/top-bar/rls-warning-banner'
import { WorkspaceProvider } from '@/components/workspace'

const SANDBOX_ENABLED = process.env.NEXT_PUBLIC_SANDBOX_MODE === 'true'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userRole = session?.user?.role ?? 'STANDARD'
  const userName = session?.user?.name ?? ''
  const userEmail = session?.user?.email ?? ''
  const userInitials = deriveInitials(userName, userEmail)

  return (
    <AuthSessionProvider session={session}>
      <div className="workspace">
        <NavDrawerProvider>
          <div className="app-shell" data-surface="calm">
            <LeftNav userRole={userRole} />
            <LeftNavDrawer userRole={userRole} />
            <div className="app-body">
              <WorkspaceProvider>
                <TopBar usageUsed={9} usageLimit={15} userInitials={userInitials} />
                {SANDBOX_ENABLED && <RlsWarningBanner />}
                <div className="app-canvas">{children}</div>
              </WorkspaceProvider>
            </div>
          </div>
        </NavDrawerProvider>
      </div>
      <SessionTimeoutGuard />
    </AuthSessionProvider>
  )
}

function deriveInitials(name: string, email: string): string {
  // First letter of the first name + first letter of the last name.
  // A single name yields just its first letter (e.g. "Antonio" → "A").
  const words = name.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w))
  if (words.length >= 2) {
    const first = words[0][0]
    const last = words[words.length - 1][0]
    return (first + last).toUpperCase()
  }
  if (words.length === 1) return words[0][0].toUpperCase()
  // Fall back to the email local part when no name is available.
  const localPart = email.split('@')[0].replace(/[^\p{L}]/gu, '')
  return (localPart.slice(0, 2) || 'AR').toUpperCase()
}
