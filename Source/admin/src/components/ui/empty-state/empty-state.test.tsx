import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from './empty-state'
import { ReceiptText } from 'lucide-react'

describe('EmptyState', () => {
  it('renders heading and body', () => {
    render(
      <EmptyState
        icon={ReceiptText}
        heading="No invoices yet"
        body="Scan your first receipt to start tracking your spending."
      />
    )
    expect(screen.getByText('No invoices yet')).toBeTruthy()
    expect(screen.getByText('Scan your first receipt to start tracking your spending.')).toBeTruthy()
  })

  it('renders CTA button when provided', () => {
    const onCta = vi.fn()
    render(
      <EmptyState
        icon={ReceiptText}
        heading="Empty"
        body="Fill it."
        ctaLabel="Go scan"
        onCta={onCta}
      />
    )
    const button = screen.getByRole('button', { name: 'Go scan' })
    fireEvent.click(button)
    expect(onCta).toHaveBeenCalledOnce()
  })

  it('does not render CTA button when not provided', () => {
    render(<EmptyState icon={ReceiptText} heading="Empty" body="No action." />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
