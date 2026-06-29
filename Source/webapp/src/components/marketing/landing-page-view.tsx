'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  Globe,
  Lock,
  Route,
  ScanLine,
  ShieldCheck,
  Split,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge, Button, Card } from '@/components/ds'
import { useAnalytics } from '@/hooks/use-analytics/use-analytics'
import { useWaitlistStatus } from '@/hooks/use-waitlist-status/use-waitlist-status'

const SIGNUP_URL = process.env.NEXT_PUBLIC_COGNITO_SIGNUP_URL ?? '/register'

const HOW_IT_WORKS = [
  {
    Icon: Camera,
    step: '01',
    title: 'Snap',
    desc: 'Photograph any receipt — even crumpled thermal paper or a PDF. Paper, restaurant bill, foreign-language till slip: all fair game.',
  },
  {
    Icon: Sparkles,
    step: '02',
    title: 'Done',
    desc: 'AI extracts every item, price, quantity, and store in seconds. You just confirm.',
    micro: 'Spot a mistake? One tap fixes it — and Wobblio learns.',
  },
  {
    Icon: BarChart3,
    step: '03',
    title: 'Save',
    desc: 'Budgets fill themselves, prices get compared across local stores, and your shopping lists get smarter with every scan.',
  },
]

const CAPABILITIES = [
  {
    Icon: ScanLine,
    title: 'AI receipt ingestion',
    desc: 'Drag, drop, or photograph. Multimodal AI reads merchant, line items, quantities, prices, and totals — zero manual entry, no bank feed.',
  },
  {
    Icon: Wallet,
    title: 'Budgets & alerts',
    desc: 'Set category budgets and get an 85% warning before the breach — and a 100% alert when it lands. Protection that is proactive, not a post-mortem.',
  },
  {
    Icon: BarChart3,
    title: 'Spend analytics',
    desc: 'A live dashboard of month-to-date spend, category breakdowns, and trends over time. See exactly where the money went.',
  },
  {
    Icon: TrendingUp,
    title: 'Anti-inflation price engine',
    desc: 'Real shelf prices from real receipts in your area — including in-store promos no website lists. Watch each item creep up, store by store.',
  },
  {
    Icon: Route,
    title: 'Split-route optimizer',
    desc: 'Build a list and Wobblio splits it across local stores for the biggest saving — with the quantified number, not a hunch.',
  },
  {
    Icon: Globe,
    title: 'Multi-currency',
    desc: 'Travel receipts convert to your home currency at the rate on the day you paid — not whenever your bank felt like it.',
  },
]

const USE_CASES = [
  {
    Icon: Users,
    title: 'Families — one picture of the money',
    hook: '"Alerts before the budget breaks — not a post-mortem after."',
    desc: 'Both partners scan as they shop. The shared household dashboard shows the real burn rate mid-month, with per-member attribution and category budgets that warn you at 85%.',
  },
  {
    Icon: Globe,
    title: 'Budget travelers — three countries, one budget',
    hook: '"Every receipt converted on the day you paid — not the day your bank felt like it."',
    desc: 'Photograph a Lisbon dinner bill at the table and watch it land in your home-currency trip budget instantly, converted at that day’s rate. No statement-shock weeks later.',
  },
  {
    Icon: TrendingUp,
    title: 'Smart shoppers — inflation is personal',
    hook: '"See exactly which store raised which price — and shop around with proof."',
    desc: 'A 6-month chart shows your coffee creeping +14% at your usual store while it stays flat next door — then the optimizer splits the basket for a quantified saving.',
  },
  {
    Icon: Split,
    title: 'Friends — one photo, tap who had what',
    hook: '"Fair split — including the tip — in your group chat in 30 seconds."',
    desc: 'One photo of the bill, tap names onto lines, fractional split on the shared starter. Service and tip scale proportionally, then export straight to WhatsApp.',
  },
]

const FAQS = [
  {
    q: 'Is my financial data safe?',
    a: 'Yes. Every row is isolated per tenant with database row-level security, sensitive free-text is encrypted, and everything is hosted in the EU. We never connect to your bank — Wobblio only reads the receipts you upload.',
  },
  {
    q: 'What happens to my receipts?',
    a: 'Original receipt images are deleted from storage after 18 months. The parsed data stays yours until you delete your account.',
  },
  {
    q: 'What is this "community price index"?',
    a: 'Anonymous price points only — product, store, region, and date. Never who you are, never your full basket. We strip every tenant and user identifier before any price crosses your account boundary.',
  },
  {
    q: 'Does it work with receipts from any store or country?',
    a: 'Yes. Wobblio reads receipts with AI rather than integrating with stores, so any merchant, language, or currency works out of the box.',
  },
  {
    q: 'Can I export or delete everything?',
    a: 'Yes — one-tap export and full account deletion, in line with GDPR Articles 17 and 20. Deletion runs a 30-day soft-lock then a hard purge; only de-identified, anonymous price points survive.',
  },
  {
    q: 'Why is there a waitlist?',
    a: 'We grow within our capacity so the experience stays fast for everyone. When the free tier is full, you can wait your turn — or skip the line with Premium.',
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

// Static 6-month price story for one relatable product across two named-look stores.
// Numbers are illustrative; the honest-data badge below the chart makes the cold-start
// limitation explicit per spec §13.2 (never overclaim observed prices).
const CHART = {
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  rising: { label: 'SuperCenter', color: 'var(--danger)', points: [4.29, 4.39, 4.55, 4.69, 4.79, 4.89] },
  flat: { label: 'MarktPlein', color: 'var(--brand)', points: [4.25, 4.19, 4.29, 4.22, 4.25, 4.19] },
}

function PriceEngineChart() {
  const W = 460
  const H = 220
  const PAD = { top: 16, right: 16, bottom: 28, left: 36 }
  const all = [...CHART.rising.points, ...CHART.flat.points]
  const min = Math.floor(Math.min(...all) * 10) / 10 - 0.1
  const max = Math.ceil(Math.max(...all) * 10) / 10 + 0.1
  const x = (i: number) =>
    PAD.left + (i * (W - PAD.left - PAD.right)) / (CHART.months.length - 1)
  const y = (v: number) =>
    PAD.top + ((max - v) / (max - min)) * (H - PAD.top - PAD.bottom)
  const path = (pts: number[]) =>
    pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  return (
    <svg
      className="price-engine-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Six-month price comparison of one product across two stores"
    >
      {[min, (min + max) / 2, max].map((v) => (
        <g key={v}>
          <line className="pe-grid" x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} />
          <text className="pe-axis" x={PAD.left - 6} y={y(v) + 3} textAnchor="end">
            €{v.toFixed(2)}
          </text>
        </g>
      ))}
      {CHART.months.map((m, i) => (
        <text key={m} className="pe-axis" x={x(i)} y={H - 8} textAnchor="middle">
          {m}
        </text>
      ))}
      {[CHART.flat, CHART.rising].map((series) => (
        <g key={series.label}>
          <path d={path(series.points)} fill="none" stroke={series.color} strokeWidth={2.5} />
          {series.points.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={series.color} />
          ))}
        </g>
      ))}
    </svg>
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
            <Link href="/login" className="btn btn--outline btn--lg">
              Sign in
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
            <Calendar size={16} /> GDPR-compliant, EU-hosted, delete everything anytime
          </div>
          <div className="trust-item">
            <Lock size={16} /> Your data stays yours — only anonymous price points are shared
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-header">
          <Badge tone="primary">How it works</Badge>
          <h2 className="section-title">From paper to data in three steps</h2>
          <p className="section-subtitle">
            Take a picture and you’re done. No typing, no spreadsheets, no bank login.
          </p>
        </div>
        <div className="how-it-works-grid">
          {HOW_IT_WORKS.map(({ Icon, step, title, desc, micro }) => (
            <Card className="how-step-card" key={step}>
              <span className="how-step-number">{step}</span>
              <div className="how-step-icon">
                <Icon size={22} />
              </div>
              <div className="how-step-title">{title}</div>
              <div className="how-step-desc">{desc}</div>
              {micro ? <div className="how-step-micro">{micro}</div> : null}
            </Card>
          ))}
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="section-header">
          <Badge tone="primary">Capabilities</Badge>
          <h2 className="section-title">Everything your receipts already know</h2>
          <p className="section-subtitle">
            One photo unlocks expense tracking, budgets, analytics, local price intelligence, and more.
          </p>
        </div>
        <div className="features-grid">
          {CAPABILITIES.map(({ Icon, title, desc }) => (
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
          <Badge tone="primary">Use cases</Badge>
          <h2 className="section-title">Built for how you actually spend</h2>
          <p className="section-subtitle">
            Whether you’re running a household, travelling on a budget, hunting deals, or splitting a dinner.
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

      <section className="landing-section" style={{ paddingTop: 0 }}>
        <Card className="price-engine">
          <div className="price-engine-copy">
            <Badge tone="primary">Anti-inflation price engine</Badge>
            <h2 className="price-engine-title">See which store raised which price.</h2>
            <p className="price-engine-caption">
              Real prices from real receipts in your area — including the in-store promos no website
              lists. Watch each item move, store by store, over six months.
            </p>
            <div className="price-engine-legend">
              <span className="pe-legend-item">
                <span className="pe-dot" style={{ background: 'var(--danger)' }} /> SuperCenter · +14%
              </span>
              <span className="pe-legend-item">
                <span className="pe-dot" style={{ background: 'var(--brand)' }} /> MarktPlein · flat
              </span>
            </div>
            <Badge tone="warning">
              Comparisons unlock as your area’s data grows — every scan makes it smarter.
            </Badge>
          </div>
          <div className="price-engine-figure">
            <div className="price-engine-product">Lavazza Coffee 250g · Eindhoven region</div>
            <PriceEngineChart />
          </div>
        </Card>
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
            <h3 className="pricing-title">Free</h3>
            <p className="pricing-desc">Genuinely usable — not a crippled trial.</p>
            <div className="pricing-price">
              <span className="pricing-currency">€</span>
              <span className="pricing-amount">0</span>
              <span className="pricing-period">/mo</span>
            </div>
            <ul className="pricing-features">
              <li>
                <Check size={16} /> 30,000 weekly credits (~3 receipt scans)
              </li>
              <li>
                <Check size={16} /> Up to 3 shopping lists
              </li>
              <li>
                <Check size={16} /> Basic reports — totals by category
              </li>
              <li>
                <Check size={16} /> Personal price history
              </li>
            </ul>
            <Link href={SIGNUP_URL} className="btn btn--outline">
              Get started free
            </Link>
          </Card>
          <Card className="pricing-card premium">
            <h3 className="pricing-title">Premium</h3>
            <p className="pricing-desc">The full price-intelligence suite for households.</p>
            <div className="pricing-price">
              <span className="pricing-currency">€</span>
              <span className="pricing-amount">{billing === 'annual' ? '25' : '2.50'}</span>
              <span className="pricing-period">{billing === 'annual' ? '/yr · 2 months free' : '/mo'}</span>
            </div>
            <ul className="pricing-features">
              <li>
                <Check size={16} /> 100,000 weekly credits (~10 scans)
              </li>
              <li>
                <Check size={16} /> Households — up to 3 members, 150,000 weekly credits pooled (~15 scans)
              </li>
              <li>
                <Check size={16} /> Budgets with 85% &amp; 100% alerts
              </li>
              <li>
                <Check size={16} /> Bill splitting &amp; WhatsApp export
              </li>
              <li>
                <Check size={16} /> Price comparison &amp; route optimizer
              </li>
              <li>
                <Check size={16} /> Multi-currency harmonization
              </li>
              <li>
                <Check size={16} /> Weekly AI savings advisor
              </li>
            </ul>
            <Link
              href={SIGNUP_URL}
              className="btn btn--primary"
              onClick={() => track('signup_start')}
            >
              Go Premium
            </Link>
          </Card>
        </div>
        <p className="pricing-footnote">
          Cancel anytime. Subscriptions are handled on the web — no app-store markup baked into your
          price.
        </p>
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
