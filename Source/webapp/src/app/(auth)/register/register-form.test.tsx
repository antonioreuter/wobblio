import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { RegisterForm } from './register-form'

const push = vi.fn()
const refresh = vi.fn()
const registerUser = vi.fn()
const signIn = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}))

vi.mock('../actions', () => ({
  registerUser: (...args: unknown[]) => registerUser(...args),
}))

function fillCredentials(password: string, confirm: string) {
  fireEvent.change(screen.getByTestId('register-email'), { target: { value: 'ada@test.nl' } })
  fireEvent.change(screen.getByTestId('register-password'), { target: { value: password } })
  fireEvent.change(screen.getByTestId('register-confirm'), { target: { value: confirm } })
}

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerUser.mockResolvedValue({})
    signIn.mockResolvedValue({})
    cleanup()
  })

  it('registers with email and password only (no profile fields — parity with Hosted UI)', async () => {
    render(<RegisterForm />)
    fillCredentials('Sup3rSecret!!', 'Sup3rSecret!!')
    fireEvent.click(screen.getByTestId('register-submit'))

    await waitFor(() => expect(registerUser).toHaveBeenCalledWith('ada@test.nl', 'Sup3rSecret!!'))
  })

  it('blocks submission and does not register when passwords mismatch', () => {
    render(<RegisterForm />)
    fillCredentials('Sup3rSecret!!', 'different')
    fireEvent.click(screen.getByTestId('register-submit'))

    expect(registerUser).not.toHaveBeenCalled()
    expect(screen.getByTestId('register-mismatch')).toBeInTheDocument()
    expect(screen.queryByTestId('register-error')).not.toBeInTheDocument()
  })
})
