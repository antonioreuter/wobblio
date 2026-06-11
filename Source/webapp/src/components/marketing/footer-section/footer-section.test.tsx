import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react';
import { FooterSection } from './footer-section';

describe('FooterSection', () => {
  it('renders all required footer links', () => {
    render(<FooterSection />);
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /terms/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact/i })).toBeInTheDocument();
  });

  it('renders the language switcher', () => {
    render(<FooterSection />);
    expect(screen.getByRole('link', { name: /NL/i })).toBeInTheDocument();
  });
});
