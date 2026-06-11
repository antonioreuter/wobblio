import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HeroSection } from './hero-section';

describe('HeroSection', () => {
  it('renders a "Start free" link when waitlist is inactive', () => {
    render(<HeroSection waitlistActive={false} />);
    expect(screen.getByRole('link', { name: 'Start free' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /join the priority waitlist/i })).not.toBeInTheDocument();
  });

  it('renders a "Join the priority waitlist" link and hides "Start free" when waitlist is active', () => {
    render(<HeroSection waitlistActive={true} />);
    expect(screen.getByRole('link', { name: /join the priority waitlist/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Start free' })).not.toBeInTheDocument();
  });

  it('renders a loading placeholder and neither CTA when waitlist state is null', () => {
    render(<HeroSection waitlistActive={null} />);
    expect(screen.getByTestId('hero-cta-loading')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Start free' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /join the priority waitlist/i })).not.toBeInTheDocument();
  });
});
