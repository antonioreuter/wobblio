export function HeroSection({ waitlistActive }: { waitlistActive: boolean | null }) {
  if (waitlistActive === null) {
    return <div data-testid="hero-cta-loading" role="status" aria-busy="true" />;
  }

  return (
    <div>
      {waitlistActive === true ? (
        <button data-testid="hero-cta-primary">Join the priority waitlist</button>
      ) : (
        <button data-testid="hero-cta-primary">Start free</button>
      )}
    </div>
  );
}
