import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RetakeDialog } from './retake-dialog'

const setup = () => {
  const onRetake = vi.fn()
  const onUploadAnyway = vi.fn()
  render(
    <RetakeDialog
      message="This photo may not read well: the photo looks blurry. Lay the receipt flat and retake, or upload it anyway."
      onRetake={onRetake}
      onUploadAnyway={onUploadAnyway}
    />,
  )
  return { onRetake, onUploadAnyway }
}

describe('RetakeDialog', () => {
  it('shows the capture-gate tip', () => {
    setup()
    expect(screen.getByTestId('retake-dialog')).toBeInTheDocument()
    expect(screen.getByText(/looks blurry/)).toBeInTheDocument()
  })

  it('calls onUploadAnyway only when "Upload anyway" is chosen', () => {
    const { onRetake, onUploadAnyway } = setup()
    fireEvent.click(screen.getByTestId('retake-upload-anyway'))
    expect(onUploadAnyway).toHaveBeenCalledOnce()
    expect(onRetake).not.toHaveBeenCalled()
  })

  it('calls onRetake for the retake button, the close button, and Escape', () => {
    const { onRetake } = setup()
    fireEvent.click(screen.getByTestId('retake-retake'))
    fireEvent.click(screen.getByTestId('retake-cancel'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onRetake).toHaveBeenCalledTimes(3)
  })
})
