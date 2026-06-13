import { auth } from '@/auth'
import { LeftNav } from '@/components/ui/left-nav'
import { TopBar } from '@/components/ui/top-bar'
import { RlsWarningBanner } from '@/components/ui/top-bar/rls-warning-banner'
import { MobileNav } from '@/components/ui/mobile-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userRole = session?.user?.role ?? 'STANDARD'

  return (
    <div className="h-screen w-screen relative overflow-hidden flex flex-col">
      {/* Background Aurora Blobs */}
      <div className="aurora-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Workspace View Container */}
      <main className="workspace-view active w-full h-full z-10 flex flex-col">
        <div className="app-shell h-full w-full bg-[rgba(8,10,19,0.4)] border-none rounded-none overflow-hidden shadow-none grid grid-cols-[80px_1fr]">
          <LeftNav userRole={userRole} />
          
          <div className="app-workspace-body flex flex-col min-w-0 h-full relative">
            <TopBar quotaUsed={7} quotaLimit={10} />
            <RlsWarningBanner />
            <main className="app-workspace-content">
              {children}
            </main>
          </div>
        </div>
      </main>

      <MobileNav userRole={userRole} />
    </div>
  )
}
