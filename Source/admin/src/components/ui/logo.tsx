import React from 'react'

export function WobblioLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 32"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Wobblio"
    >
      <defs>
        <linearGradient id="wob-logo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      {/* Top wave: rises to peak, drops, and goes horizontal */}
      <path
        d="M 6 22 C 10 22, 14 6, 20 6 C 24 6, 26 18, 32 14 L 42 14"
        stroke="url(#wob-logo-gradient)"
        strokeWidth={3.5}
      />
      {/* Bottom wave: flat, curves up to peak, drops, and goes horizontal */}
      <path
        d="M 6 22 C 10 22, 15 26, 20 20 C 23 16, 26 12, 30 16 C 33 19, 36 24, 42 24"
        stroke="url(#wob-logo-gradient)"
        strokeWidth={3.5}
      />
    </svg>
  )
}
