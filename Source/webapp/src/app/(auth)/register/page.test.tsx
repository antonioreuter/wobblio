import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import RegisterPage from './page'

// The page branches on COGNITO_ENDPOINT: set → local credentials form,
// unset (AWS) → Hosted-UI signup redirect. Stub the leaf-component deps so we
// exercise the real branch wiring without hitting next-auth / server actions.
const signIn = vi.fn()

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('../actions', () => ({
  registerUser: vi.fn(),
}))

describe('RegisterPage environment branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders the credentials register form on local dev (COGNITO_ENDPOINT set)', () => {
    vi.stubEnv('COGNITO_ENDPOINT', 'http://localhost:9229')
    render(<RegisterPage />)

    expect(screen.getByTestId('register-form')).toBeInTheDocument()
    expect(screen.queryByTestId('hosted-ui-signup-redirect')).not.toBeInTheDocument()
  })

  it('renders the Hosted-UI signup redirect on AWS (COGNITO_ENDPOINT unset)', () => {
    vi.stubEnv('COGNITO_ENDPOINT', '')
    render(<RegisterPage />)

    expect(screen.getByTestId('hosted-ui-signup-redirect')).toBeInTheDocument()
    expect(screen.queryByTestId('register-form')).not.toBeInTheDocument()
  })
})
