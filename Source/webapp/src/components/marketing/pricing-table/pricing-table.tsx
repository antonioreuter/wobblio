'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

const PREMIUM_FEATURES = [
  'Unlimited scans',
  'Household sharing & alerts',
  'Budgets & smart alerts',
  'Bill splitting → WhatsApp',
  'Price comparison & route optimizer',
  'Multi-currency support',
  'Weekly AI savings advisor',
];

const FREE_FEATURES = [
  '3 scans / week',
  '3 shopping lists',
  'Basic reports',
];

export function PricingTable() {
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual');

  return (
    <section data-testid="pricing-table">
      <div className="flex items-center justify-center gap-4 mb-8">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="billing"
            value="annual"
            checked={billing === 'annual'}
            onChange={() => setBilling('annual')}
            aria-label="Annual"
          />
          Annual
          {billing === 'annual' && (
            <span className="ml-2 rounded-full bg-[#0d9488] px-2 py-0.5 text-xs text-white">
              2 months free
            </span>
          )}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="billing"
            value="monthly"
            checked={billing === 'monthly'}
            onChange={() => setBilling('monthly')}
            aria-label="Monthly"
          />
          Monthly
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 max-w-3xl mx-auto">
        <div
          className={cn('rounded-xl border p-6', 'border-[#e2e8f0] dark:border-[#1e293b]')}
          data-testid="plan-free"
        >
          <h3 className="text-lg font-semibold mb-1">Free</h3>
          <p className="text-3xl font-bold mb-4">€0</p>
          <ul className="space-y-2 text-sm">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-[#0d9488]">✓</span> {f}
              </li>
            ))}
          </ul>
          <a
            href={process.env.NEXT_PUBLIC_COGNITO_SIGNUP_URL ?? '/auth/signup'}
            className="mt-6 block w-full rounded-lg border border-[#0d9488] py-2 text-center text-sm font-medium text-[#0d9488] hover:bg-[#ccfbf1]"
            data-testid="cta-free"
          >
            Get started free
          </a>
        </div>

        <div
          className="rounded-xl border border-[#0d9488] bg-[#0d9488] p-6 text-white"
          data-testid="plan-premium"
        >
          <h3 className="text-lg font-semibold mb-1">Premium</h3>
          <p className="text-3xl font-bold mb-1">
            {billing === 'annual' ? '€25' : '€2.50'}
            <span className="text-base font-normal">
              {billing === 'annual' ? '/yr' : '/mo'}
            </span>
          </p>
          <p className="text-xs mb-4 opacity-80">
            {billing === 'annual' ? '≈ €2.08/mo' : 'Billed monthly'}
          </p>
          <ul className="space-y-2 text-sm">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span>✓</span> {f}
              </li>
            ))}
          </ul>
          <a
            href={`${process.env.NEXT_PUBLIC_COGNITO_SIGNUP_URL ?? '/auth/signup'}?plan=premium_${billing}`}
            className="mt-6 block w-full rounded-lg bg-white py-2 text-center text-sm font-medium text-[#0d9488] hover:bg-[#f0fdfa]"
            data-testid="cta-premium"
          >
            Get Premium
          </a>
          <p className="mt-3 text-center text-xs opacity-75">
            Cancel anytime. Subscriptions handled on the web — no app-store markup.
          </p>
        </div>
      </div>
    </section>
  );
}
