import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react';
import { PriceEngineShowcase } from './price-engine-showcase';

describe('PriceEngineShowcase', () => {
  it('renders the section heading', () => {
    render(<PriceEngineShowcase />);
    expect(screen.getByText(/Anti-Inflation Price Engine/i)).toBeInTheDocument();
  });

  it('renders the honest data-freshness badge', () => {
    render(<PriceEngineShowcase />);
    expect(screen.getByText(/every scan makes it smarter/i)).toBeInTheDocument();
  });
});
