'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

const FAQS = [
  {
    q: 'Is my financial data safe?',
    a: 'Yes. RLS, encryption, EU hosting, no bank link — your data never leaves our EU infrastructure and is never sold.',
  },
  {
    q: 'What happens to my receipts?',
    a: 'Receipt images are deleted after 18 months. Parsed data is kept until you delete your account.',
  },
  {
    q: "What's this \"community price index\"?",
    a: 'Only anonymous price points are shared — product, store, region, and date. Never who bought, never a full basket.',
  },
  {
    q: 'Does it work with receipts from any store or country?',
    a: 'Yes. Wobblio uses AI reading, not store integrations — any receipt from any country works.',
  },
  {
    q: 'Can I export or delete everything?',
    a: 'Yes. One-tap export and full deletion are available under Settings, in compliance with GDPR Art. 17 and 20.',
  },
  {
    q: "Why is there a waitlist?",
    a: "It's a capacity guardrail to keep the service fast for everyone. Premium subscribers skip the line.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section data-testid="faq-section">
      <dl>
        {FAQS.map((faq, i) => (
          <div key={i} className="border-b border-[#e2e8f0] dark:border-[#1e293b]">
            <dt>
              <button
                type="button"
                aria-expanded={openIndex === i}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between py-4 text-left font-medium"
                data-testid={`faq-question-${i}`}
              >
                {faq.q}
                <span aria-hidden="true" className={cn('ml-4 transition-transform', openIndex === i && 'rotate-180')}>▾</span>
              </button>
            </dt>
            {openIndex === i && (
              <dd className="pb-4 text-[#64748b] dark:text-[#94a3b8]" data-testid={`faq-answer-${i}`}>
                {faq.a}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
