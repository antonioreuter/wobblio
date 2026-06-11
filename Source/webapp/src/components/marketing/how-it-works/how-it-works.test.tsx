import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react';
import { HowItWorks } from './how-it-works';

describe('HowItWorks', () => {
  it('renders all three steps', () => {
    render(<HowItWorks />);
    expect(screen.getByText(/Snap/i)).toBeInTheDocument();
    expect(screen.getByText(/Done/i)).toBeInTheDocument();
    expect(screen.getByText(/Save/i)).toBeInTheDocument();
  });

  it('renders the microcopy on step 2', () => {
    render(<HowItWorks />);
    expect(screen.getByText(/Spot a mistake/i)).toBeInTheDocument();
  });
});
