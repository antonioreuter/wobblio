import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HeroSection } from './hero-section';

describe('HeroSection', () => {
  it('renders a "Start free" button when waitlist is inactive', () => {
    render(<HeroSection waitlistActive={false} />);
    expect(screen.getByRole('button', { name: 'Start free' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /join the priority waitlist/i })).not.toBeInTheDocument();
  });

  it('renders a "Join the priority waitlist" button and hides "Start free" when waitlist is active', () => {
    render(<HeroSection waitlistActive={true} />);
    expect(screen.getByRole('button', { name: /join the priority waitlist/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start free' })).not.toBeInTheDocument();
  });

  it('renders a loading placeholder and neither CTA button when waitlist state is null', () => {
    render(<HeroSection waitlistActive={null} />);
    expect(screen.getByTestId('hero-cta-loading')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start free' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /join the priority waitlist/i })).not.toBeInTheDocument();
  });
});
