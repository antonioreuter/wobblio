import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react';
import { PersonaGrid } from './persona-grid';

describe('PersonaGrid', () => {
  it('renders all six persona cards', () => {
    render(<PersonaGrid />);
    expect(screen.getByText(/Traveler/i)).toBeInTheDocument();
    expect(screen.getByText(/Family CFO/i)).toBeInTheDocument();
    expect(screen.getByText(/Student/i)).toBeInTheDocument();
    expect(screen.getByText(/Inflation Hunter/i)).toBeInTheDocument();
    expect(screen.getByText(/Friend Group/i)).toBeInTheDocument();
    expect(screen.getByText(/Border Shopper/i)).toBeInTheDocument();
  });
});
