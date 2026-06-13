'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Box,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  Globe,
  Lock,
  ShieldCheck,
  Split,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'
import { Badge, Button, Card } from '@/components/ds'
import { useAnalytics } from '@/hooks/use-analytics/use-analytics'
import { useWaitlistStatus } from '@/hooks/use-waitlist-status/use-waitlist-status'

const SIGNUP_URL = process.env.NEXT_PUBLIC_COGNITO_SIGNUP_URL ?? '/register'

const FEATURES = [
  {
    Icon: Camera,
    title: 'AI Ingestion',
    desc: 'Drag and drop receipt photos. AI extracts merchant names, product descriptions, quantities, and prices in seconds.',
  },
  {
    Icon: TrendingUp,
    title: 'Price Trends',
    desc: 'Interactive charts show how your everyday items fluctuate across local chains over time.',
  },
  {
    Icon: Box,
    title: 'List Optimizer',
    desc: 'Build a list and compare store prices — get the cheapest local store recommendations instantly.',
  },
]

const USE_CASES = [
  {
    Icon: Users,
    title: 'One family, one picture of the money',
    hook: '"Alerts before the budget breaks — not a post-mortem after."',
    desc: 'Share uploads across household members. Track combined totals and trigger warnings before you overspend.',
  },
  {
    Icon: TrendingUp,
    title: 'Inflation is personal',
    hook: '"See exactly which store raised which price — and shop around with proof."',
    desc: 'Map price details across brands and chains. Watch charts creep up and find where items are cheapest.',
  },
  {
    Icon: Split,
    title: 'One photo. Tap who had what',
    hook: '"Fair split — including the tip — in your group chat in 30 seconds."',
    desc: 'Split restaurant bills proportionally. Allocates service and tip automatically, then exports to WhatsApp.',
  },
  {
    Icon: Globe,
    title: 'Three countries, one budget',
    hook: '"Every receipt converted on the day you paid — not when your bank felt like it."',
    desc: 'Scan foreign receipts on the go. Converts currencies on the transaction date, with zero bank lag.',
  },
]

const FAQS = [
  {
    q: 'Does Wobblio need access to my bank?',
    a: 'No. We never connect to your bank. Wobblio reads only the receipts you upload, so the data stays with you.',
  },
  {
    q: 'How private is the price data I share?',
    a: 'Anonymized price points feed a regional index. We strip tenant and user identifiers before any cross-household aggregation.',
  },
  {
    q: 'What does AI ingestion actually do?',
    a: 'It extracts merchant, items, quantities, prices, and totals from photos of paper or PDF receipts — no manual typing.',
  },
  {
    q: 'Can I delete my data?',
    a: 'Yes. GDPR-compliant deletion runs a 30-day soft-lock then a hard purge. Anonymized price observations stay; nothing personal survives.',
  },
]

const HERO_ITEMS: Array<[string, string]> = [
  ['Organic Whole Milk 1L', '€3.89'],
  ['Free Range Eggs (12)', '€4.25'],
  ['Sourdough Bread 800g', '€2.99'],
]

function HeroMockup() {
  const [state, setState] = useState<'idle' | 'scanning' | 'done'>('idle')

  const run = () => {
    if (state === 'scanning') return
    setState('scanning')
    setTimeout(() => setState('done'), 1500)
  }

  return (
    <Card className="interactive-mockup">
      <div className="mockup-header">
        <div>
          <span className="mockup-store-name">Lidl — Lisbon Norte</span>
          <span className="mockup-date">25 May 2026</span>
        </div>
        <Badge tone={state === 'done' ? 'success' : 'warning'}>
          {state === 'done' ? 'Processed' : 'Scanning'}
        </Badge>
      </div>
      {state !== 'done' ? (
        <div
          className="upload-dropzone"
          onClick={run}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') run()
          }}
        >
          <div className="upload-icon">
            <Upload size={32} />
          </div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}
          >
            {state === 'scanning' ? 'Reading receipt…' : 'Click to scan a receipt'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {state === 'scanning' ? 'AI extracting line items' : 'Simulate AI parsing instantly'}
          </p>
        </div>
      ) : (
        <div className="mockup-item-list">
          {HERO_ITEMS.map(([name, price]) => (
            <div className="mockup-item" key={name}>
              <span className="mockup-item-name">{name}</span>
              <span className="mockup-item-price">{price}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mockup-footer">
        <span className="mockup-total-label">Total</span>
        <span className="mockup-total-value">€11.13</span>
      </div>
    </Card>
  )
}

export function LandingPageView() {
  const { waitlistActive } = useWaitlistStatus()
  const { track } = useAnalytics()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

  const showWaitlist = waitlistActive === true
  const primaryCtaLabel = showWaitlist ? 'Join the priority waitlist' : 'Start ingesting free'
  const primaryCtaHref = showWaitlist ? '/waitlist' : SIGNUP_URL

  const handleHeroCta = () => {
    track('hero_cta_click')
    track(showWaitlist ? 'waitlist_join' : 'signup_start')
  }

  return (
    <>
      <section className="hero-section">
        <div className="hero-content">
          <Badge tone="primary">Smart Expense Ingestion</Badge>
          <h1 className="hero-title">Scan your receipts. Outsmart inflation.</h1>
          <p className="hero-description">
            Wobblio reads any receipt with AI — automatic expense tracking, real local price
            comparison, and shopping lists that know the cheapest store. No bank access. Ever.
          </p>
          <div className="hero-actions">
            <Link
              href={primaryCtaHref}
              className="btn btn--primary btn--lg"
              onClick={handleHeroCta}
              data-testid="hero-primary-cta"
            >
              {primaryCtaLabel} <ArrowRight size={18} />
            </Link>
          </div>
          <div className="landing-stats-grid">
            {[
              ['OCR Scan Speed', '< 8 sec'],
              ['Privacy Level', '100% Private'],
              ['GDPR Status', 'Fully Ready'],
            ].map(([label, value]) => (
              <Card key={label} className="landing-stat-card">
                <div className="landing-stat-label">{label}</div>
                <div className="landing-stat-value">{value}</div>
              </Card>
            ))}
          </div>
        </div>
        <div>
          <HeroMockup />
        </div>
      </section>

      <section className="trust-strip">
        <div className="trust-strip-inner">
          <div className="trust-item">
            <ShieldCheck size={16} /> No bank connection required
          </div>
          <div className="trust-item">
            <Calendar size={16} /> GDPR-compliant, EU-hosted, delete anytime
          </div>
          <div className="trust-item">
            <Lock size={16} /> Only anonymized prices are ever shared
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-header">
          <Badge tone="primary">Capabilities</Badge>
          <h2 className="section-title">Designed for household intelligence</h2>
          <p className="section-subtitle">
            From AI extraction to price trends — the entire flow runs automatically.
          </p>
        </div>
        <div className="features-grid">
          {FEATURES.map(({ Icon, title, desc }) => (
            <Card interactive className="feature-card" key={title}>
              <div className="feature-icon">
                <Icon size={22} />
              </div>
              <div className="feature-title">{title}</div>
              <div className="feature-desc">{desc}</div>
            </Card>
          ))}
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="section-header">
          <Badge tone="primary">Use Cases</Badge>
          <h2 className="section-title">Built for how you actually spend</h2>
          <p className="section-subtitle">
            Wobblio adapts to your lifestyle — household, travel, or local savings hunting.
          </p>
        </div>
        <div className="use-cases-grid">
          {USE_CASES.map(({ Icon, title, hook, desc }) => (
            <Card interactive className="use-case-card" key={title}>
              <div className="use-case-icon">
                <Icon size={22} />
              </div>
              <div>
                <div className="use-case-title">{title}</div>
                <span className="use-case-hook">{hook}</span>
                <div className="use-case-desc">{desc}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 0, textAlign: 'center' }}>
        <div className="section-header">
          <Badge tone="primary">Pricing</Badge>
          <h2 className="section-title">Ready to start saving?</h2>
          <p className="section-subtitle">Annual billing is two months free.</p>
        </div>
        <div className="pricing-toggle" role="tablist" aria-label="Billing period">
          <button
            type="button"
            role="tab"
            aria-selected={billing === 'monthly'}
            className={billing === 'monthly' ? 'on' : ''}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={billing === 'annual'}
            className={billing === 'annual' ? 'on' : ''}
            onClick={() => {
              setBilling('annual')
              track('pricing_view')
            }}
          >
            Annual · 2 months free
          </button>
        </div>
        <div className="pricing-grid">
          <Card className="pricing-card">
            <h3 className="pricing-title">Standard</h3>
            <p className="pricing-desc">Perfect for basic receipt tracking.</p>
            <div className="pricing-price">
              <span className="pricing-currency">€</span>
              <span className="pricing-amount">0</span>
              <span className="pricing-period">/mo</span>
            </div>
            <ul className="pricing-features">
              <li>
                <Check size={16} /> 10 scans per month
              </li>
              <li>
                <Check size={16} /> Standard AI ingestion
              </li>
              <li>
                <Check size={16} /> Single-user workspace
              </li>
            </ul>
            <Link href={SIGNUP_URL} className="btn btn--outline">
              Get started
            </Link>
          </Card>
          <Card className="pricing-card premium">
            <h3 className="pricing-title">Household Pro</h3>
            <p className="pricing-desc">Complete sync for active families.</p>
            <div className="pricing-price">
              <span className="pricing-currency">€</span>
              <span className="pricing-amount">{billing === 'annual' ? '6.58' : '8'}</span>
              <span className="pricing-period">/mo{billing === 'annual' ? ', billed yearly' : ''}</span>
            </div>
            <ul className="pricing-features">
              <li>
                <Check size={16} /> Unlimited scans
              </li>
              <li>
                <Check size={16} /> Shared household pool
              </li>
              <li>
                <Check size={16} /> List optimizer &amp; store comparisons
              </li>
              <li>
                <Check size={16} /> WhatsApp reports &amp; exports
              </li>
            </ul>
            <Link
              href={SIGNUP_URL}
              className="btn btn--primary"
              onClick={() => track('signup_start')}
            >
              Upgrade now
            </Link>
          </Card>
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="section-header">
          <Badge tone="primary">FAQ</Badge>
          <h2 className="section-title">Questions, answered</h2>
        </div>
        <div className="faq-list">
          {FAQS.map(({ q, a }) => (
            <details className="faq-item" key={q}>
              <summary className="faq-summary">
                {q} <ChevronDown size={18} />
              </summary>
              <div className="faq-body">{a}</div>
            </details>
          ))}
        </div>
      </section>

      <Button
        variant="primary"
        size="lg"
        iconRight={<ArrowRight size={18} />}
        onClick={() => {
          handleHeroCta()
          window.location.href = primaryCtaHref
        }}
        style={{ display: 'flex', margin: '0 auto 60px' }}
        data-testid="footer-primary-cta"
      >
        {primaryCtaLabel}
      </Button>

      <footer className="landing-footer">
        © {new Date().getFullYear()} Wobblio · Built in Eindhoven · GDPR-compliant, EU-hosted
      </footer>
    </>
  )
}
