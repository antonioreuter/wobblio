import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react';
import { PersonaGrid } from './persona-grid';

describe('PersonaGrid', () => {
  it('renders all four persona cards', () => {
    render(<PersonaGrid />);
    expect(screen.getByText(/Families/i)).toBeInTheDocument();
    expect(screen.getByText(/Smart shoppers/i)).toBeInTheDocument();
    expect(screen.getByText(/Friends/i)).toBeInTheDocument();
    expect(screen.getByText(/Travelers/i)).toBeInTheDocument();
  });
});
