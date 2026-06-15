import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import AppLayout from './layout'

// The (app) layout is the server-side auth gate. These tests pin the three gate
// decisions — most importantly that a failed silent token refresh
// (RefreshAccessTokenError) triggers a federated sign-out (ForceSignOut) rather
// than a redirect to /login, which would auto-re-authenticate against the still
// valid Cognito SSO cookie and loop.

const redirect = vi.fn((path: string) => {
  // next/navigation redirect() throws to halt rendering; mimic that so callers
  // below the gate never run.
  throw new Error(`REDIRECT:${path}`)
})
let sessionValue: unknown = null
const fetchOnboardingState = vi.fn(async () => 'onboarded')

vi.mock('next/navigation', () => ({ redirect: (p: string) => redirect(p) }))
vi.mock('@/auth', () => ({ auth: () => Promise.resolve(sessionValue) }))
vi.mock('@/lib/server/onboarding-status', () => ({
  fetchOnboardingState: () => fetchOnboardingState(),
}))

// Light stubs for the rest so the module graph stays focused on the gate.
vi.mock('@/components/auth/force-sign-out', () => ({
  ForceSignOut: () => <div data-testid="force-sign-out" />,
}))
vi.mock('@/components/providers/auth-session-provider', () => ({
  AuthSessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/auth/session-timeout-guard', () => ({ SessionTimeoutGuard: () => null }))
vi.mock('@/components/ui/left-nav', () => ({
  LeftNav: () => null,
  LeftNavDrawer: () => null,
  NavDrawerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/top-bar', () => ({ TopBar: () => null }))
vi.mock('@/components/ui/top-bar/rls-warning-banner', () => ({ RlsWarningBanner: () => null }))
vi.mock('@/components/workspace', () => ({
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

async function renderLayout() {
  const ui = await AppLayout({ children: <div data-testid="app-child" /> })
  render(ui)
}

describe('(app) layout auth gate', () => {
  beforeEach(() => {
    cleanup()
    redirect.mockClear()
    fetchOnboardingState.mockClear()
    fetchOnboardingState.mockResolvedValue('onboarded')
  })

  it('redirects to /login when there is no session', async () => {
    sessionValue = null
    await expect(renderLayout()).rejects.toThrow('REDIRECT:/login')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('force-signs-out (not /login) when the silent token refresh failed', async () => {
    sessionValue = { user: { onboarded: true }, error: 'RefreshAccessTokenError' }
    await renderLayout()
    expect(screen.getByTestId('force-sign-out')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('renders the app for a valid, onboarded session', async () => {
    sessionValue = { user: { onboarded: true, role: 'STANDARD', name: 'Ada', email: 'a@b.c' } }
    await renderLayout()
    expect(screen.getByTestId('app-child')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects to /onboarding when the DB self-heal still reports pending', async () => {
    sessionValue = { user: { onboarded: false, role: 'STANDARD', name: '', email: 'a@b.c' } }
    fetchOnboardingState.mockResolvedValue('pending')
    await expect(renderLayout()).rejects.toThrow('REDIRECT:/onboarding')
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })
})
