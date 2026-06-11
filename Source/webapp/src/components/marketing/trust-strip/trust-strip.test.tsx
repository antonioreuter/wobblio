import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react';
import { TrustStrip } from './trust-strip';

describe('TrustStrip', () => {
  it('renders all three trust claims', () => {
    render(<TrustStrip />);
    expect(screen.getByText(/No bank connection required/i)).toBeInTheDocument();
    expect(screen.getByText(/GDPR-compliant/i)).toBeInTheDocument();
    expect(screen.getByText(/Your data stays yours/i)).toBeInTheDocument();
  });
});
