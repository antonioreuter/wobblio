'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Globe, 
  Users, 
  GraduationCap, 
  TrendingUp, 
  Split, 
  MapPin,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { useWaitlistStatus } from '@/hooks/use-waitlist-status/use-waitlist-status';
import { useAnalytics } from '@/hooks/use-analytics/use-analytics';
import { WobblioLogo } from '@/components/ui/logo';

const SIGNUP_URL = process.env.NEXT_PUBLIC_COGNITO_SIGNUP_URL ?? '/auth/signup';
const SIGNIN_URL = process.env.NEXT_PUBLIC_COGNITO_SIGNIN_URL ?? '/auth/signin';

const PERSONAS = [
  {
    id: 'family-cfo',
    title: 'Family CFO',
    headline: 'One family, one picture of the money',
    hook: '"Alerts before the budget breaks — not a post-mortem after."',
    description: 'Share uploads across household members. Track combined totals and trigger warning alerts before you overspend on monthly categories.',
    Icon: Users,
  },
  {
    id: 'inflation-hunter',
    title: 'Inflation Hunter',
    headline: 'Inflation is personal',
    hook: '"See exactly which store raised which price — and shop around with proof."',
    description: 'Map price details dynamically across brands and chains. See price charts creeping up and check where items are cheapest.',
    Icon: TrendingUp,
  },
  {
    id: 'friend-group',
    title: 'Friend Group',
    headline: 'One photo. Tap who had what',
    hook: '"Fair split — including the tip — in your group chat in 30 seconds."',
    description: 'Split restaurant bills and group trips proportionally. Allocates service fees and tip automatically, then exports directly to WhatsApp.',
    Icon: Split,
  },
  {
    id: 'traveler',
    title: 'Traveler',
    headline: 'Three countries, one budget',
    hook: '"Every receipt converted on the day you paid — not the day your bank felt like it."',
    description: 'Scan foreign receipts on the go. Converts currencies on the transaction date so you know exactly what a trip cost, with zero bank lags.',
    Icon: Globe,
  },
  {
    id: 'student',
    title: 'Student',
    headline: 'Same basket, 22% cheaper',
    hook: '"Your receipts knew — now you do."',
    description: 'Discover invisible spending leaks (snacks, deliveries, that expensive store next to campus) and split house shared items in two taps.',
    Icon: GraduationCap,
  },
  {
    id: 'border-shopper',
    title: 'Border Shopper / Expats',
    headline: 'Cross-Border Savings Check',
    hook: '"Is the drive across the border still worth it?"',
    description: 'Compare actual paid prices across countries (e.g. Netherlands vs Germany/Belgium) to see if border shopping is genuinely saving you money.',
    Icon: MapPin,
  },
];

export function LandingPageView() {
  const { resolvedTheme, setTheme } = useTheme();
  const { waitlistActive } = useWaitlistStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const { track } = useAnalytics();

  // Pricing toggle state
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  // How It Works timeline active step state
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Ingestion simulation mockup states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressText, setProgressText] = useState('Uploading receipt...');
  const [scanState, setScanState] = useState<'idle' | 'progress' | 'scanning' | 'processed'>('processed');
  const [previewImage, setPreviewImage] = useState('/invoices/ah_to_go_1.jpeg');
  const [mockupStore, setMockupStore] = useState('Lidl — Lisbon Norte');
  const [mockupDate, setMockupDate] = useState('25 May 2026');
  const [mockupStatus, setMockupStatus] = useState('PROCESSED');
  const [mockupTotal, setMockupTotal] = useState('€11.13');
  const [mockupGlow, setMockupGlow] = useState(false);
  const [mockupItems, setMockupItems] = useState<Array<{ name: string; price: string }>>([
    { name: 'Organic Whole Milk 1L', price: '€3.89' },
    { name: 'Free Range Eggs (12)', price: '€4.25' },
    { name: 'Sourdough Bread 800g', price: '€2.99' },
  ]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleUploadClick = () => {
    if (isUploading) return;
    simulateUpload();
  };

  const simulateUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    setScanState('progress');
    setProgressText('Uploading receipt...');
    setMockupItems([]);

    const images = ['/invoices/ah_to_go_1.jpeg', '/invoices/jumbo_1.jpeg', '/invoices/ah_1.jpeg'];
    const randomImg = images[Math.floor(Math.random() * images.length)];

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setUploadProgress(currentProgress);

      if (currentProgress === 40) {
        setProgressText('Adjusting contrast...');
      } else if (currentProgress === 80) {
        setProgressText('Extracting products and prices...');
      }

      if (currentProgress >= 100) {
        clearInterval(interval);
        setScanState('scanning');
        setProgressText('Reading details...');
        setPreviewImage(randomImg);

        setTimeout(() => {
          setIsUploading(false);
          setScanState('processed');
          setMockupStore('Lidl — Lisbon Norte');
          setMockupDate('25 May 2026');
          setMockupStatus('PROCESSED');
          setMockupTotal('€11.13');
          setMockupItems([
            { name: 'Organic Whole Milk 1L', price: '€3.89' },
            { name: 'Free Range Eggs (12)', price: '€4.25' },
            { name: 'Sourdough Bread 800g', price: '€2.99' },
          ]);
          setMockupGlow(true);

          setTimeout(() => {
            setMockupGlow(false);
          }, 1500);
        }, 2500);
      }
    }, 200);
  };

  const handleSignupClick = () => {
    if (waitlistActive) {
      track('waitlist_join');
    } else {
      track('signup_start');
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Background Aurora Blobs */}
      <div className="aurora-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Global Header */}
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand" id="logoLink">
            <div className="brand-icon-wrap">
              <WobblioLogo className="w-full h-full" />
            </div>
            <span className="brand-text">
              wobbl<span className="brand-accent">io</span>
            </span>
          </Link>

          <nav className="site-nav-group" aria-label="Primary Navigation">
            <div className="site-nav-links">
              <Link href="/" className="site-nav-link active" id="navLanding">
                Home
              </Link>
              <Link href="/dashboard" className="site-nav-link" id="navApp">
                Workspace
              </Link>
            </div>
            
            <button 
              className="btn-icon-only flex items-center justify-center" 
              id="globalThemeToggle" 
              onClick={toggleTheme}
              title="Toggle Light/Dark Theme"
            >
              {mounted ? (
                resolvedTheme === 'light' ? (
                  <Sun size={20} className="text-[#0f172a] dark:text-[#f8fafc]" />
                ) : (
                  <Moon size={20} className="text-[#0f172a] dark:text-[#f8fafc]" />
                )
              ) : (
                <div style={{ width: '20px', height: '20px' }} />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Landing View Container */}
      <main className="landing-view" id="landingView">
        
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <span className="badge badge--primary hero-eyebrow">Smart Expense Ingestion</span>
            <h1 className="hero-title">Scan your receipts.<br />Outsmart inflation.</h1>
            <p className="hero-description">
              Wobblio reads any receipt worldwide with AI — automatic expense breakdown, real local price comparison, and shopping lists that locate the cheapest store. No bank connection required. Ever.
            </p>
            
            <div className="hero-actions">
              {waitlistActive === null ? (
                <div data-testid="hero-cta-loading" role="status" aria-busy="true" className="h-12 w-48 bg-slate-800 animate-pulse rounded-lg" />
              ) : waitlistActive ? (
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <p className="text-xs text-[var(--text-muted)] italic mb-1">
                    2,140 people ahead of you — or skip the line with Premium
                  </p>
                  <Link 
                    href={`${SIGNUP_URL}?waitlist=true`}
                    onClick={handleSignupClick}
                    className="btn btn--primary"
                    data-testid="hero-cta-primary"
                  >
                    Join the priority waitlist
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2"/>
                    </svg>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <Link 
                    href={SIGNUP_URL}
                    onClick={handleSignupClick}
                    className="btn btn--primary"
                    data-testid="hero-cta-primary"
                  >
                    Start Ingesting Free
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                      <path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2"/>
                    </svg>
                  </Link>
                  <Link 
                    href={SIGNIN_URL} 
                    className="btn btn--outline"
                    data-testid="hero-cta-secondary"
                  >
                    Sign In
                  </Link>
                </div>
              )}
              <a href="#use-cases" className="btn btn--outline">Explore Use Cases</a>
            </div>

            {/* Metric Strip */}
            <div className="landing-stats-grid">
              <div className="glass landing-stat-card">
                <div className="landing-stat-label">OCR Scan Speed</div>
                <div className="landing-stat-value">&lt; 8s</div>
              </div>
              <div className="glass landing-stat-card">
                <div className="landing-stat-label">Privacy level</div>
                <div className="landing-stat-value">100%</div>
              </div>
              <div className="glass landing-stat-card">
                <div className="landing-stat-label">GDPR Status</div>
                <div className="landing-stat-value">Ready</div>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div 
              className="glass interactive-mockup" 
              id="landingUploadMockup"
              style={{
                boxShadow: mockupGlow ? '0 0 30px 5px var(--brand-glow)' : 'var(--card-shadow)',
                transition: 'box-shadow 0.3s ease, transform 0.3s ease'
              }}
            >
              <div className="mockup-header">
                <div className="mockup-store-info">
                  <span className="mockup-store-name" id="mockupStoreName">{mockupStore}</span>
                  <span className="mockup-date" id="mockupDate">{mockupDate}</span>
                </div>
                <span className={`badge ${mockupStatus === 'PROCESSED' ? 'badge--success' : 'badge--warning'}`} id="mockupStatus">
                  {mockupStatus}
                </span>
              </div>

              {/* Interactive Upload Dropzone */}
              <div className="upload-dropzone" id="dropzoneWidget" onClick={handleUploadClick}>
                <div className="upload-icon" style={{ opacity: isUploading ? 0.1 : 1, transition: 'opacity 0.2s' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="32" height="32">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeWidth="2"/>
                  </svg>
                </div>
                <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', opacity: isUploading ? 0.1 : 1, transition: 'opacity 0.2s' }}>
                  Click to scan a receipt
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', opacity: isUploading ? 0.1 : 1, transition: 'opacity 0.2s' }}>
                  Simulate AI parsing instantly
                </p>
                
                {/* Upload Progress Bar */}
                {scanState === 'progress' && (
                  <div className="upload-progress-container" id="widgetProgressContainer" style={{ display: 'block' }}>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" id="widgetProgressBar" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--brand)', marginTop: '6px' }} id="progressText">
                      {progressText}
                    </p>
                  </div>
                )}

                {/* Scanner Beam Animation */}
                {scanState === 'scanning' && (
                  <div className="scanner-container" id="widgetScannerContainer" style={{ display: 'block' }}>
                    <div className="scan-beam"></div>
                    <img src={previewImage} className="scanner-image" id="scannerPreviewImage" alt="AI OCR Preview" />
                  </div>
                )}
              </div>

              {/* Parsed Mock Items */}
              <div className="mockup-item-list" id="mockupItemsContainer">
                {mockupItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="mockup-item" 
                    style={{ animation: `fadeIn 0.4s ease forwards ${idx * 0.1}s` }}
                  >
                    <span className="mockup-item-name">{item.name}</span>
                    <span className="mockup-item-price">{item.price}</span>
                  </div>
                ))}
              </div>

              <div className="mockup-footer">
                <span className="mockup-total-label">TOTAL</span>
                <span className="mockup-total-value" id="mockupTotal">{mockupTotal}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Strip Section */}
        <section className="trust-strip">
          <div className="trust-strip-inner">
            <div className="trust-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <polyline points="9 11 11 13 15 9"/>
              </svg>
              No bank connection required
            </div>
            <div className="trust-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              GDPR-compliant, EU-hosted
            </div>
            <div className="trust-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Your data remains private
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section" id="features">
          <div className="section-header">
            <span className="badge badge--primary section-eyebrow">CAPABILITIES</span>
            <h2 className="section-title">Designed for household intelligence</h2>
            <p className="section-subtitle">From AI extraction to price trends — the entire flow runs automatically.</p>
          </div>

          <div className="features-grid">
            <div className="glass feature-card">
              <div className="feature-icon-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeWidth="2"/>
                  <circle cx="12" cy="13" r="4" strokeWidth="2"/>
                </svg>
              </div>
              <h3 className="feature-title">AI Ingestion</h3>
              <p className="feature-desc">Drag and drop receipt photos. AI extracts merchant names, product descriptions, quantities, and prices in seconds.</p>
            </div>

            <div className="glass feature-card">
              <div className="feature-icon-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="2"/>
                </svg>
              </div>
              <h3 className="feature-title">Price Trends</h3>
              <p className="feature-desc">Interactive charts show how your everyday items fluctuate across local chains over time.</p>
            </div>

            <div className="glass feature-card">
              <div className="feature-icon-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeWidth="2"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" strokeWidth="2"/>
                  <line x1="12" y1="22.08" x2="12" y2="12" strokeWidth="2"/>
                </svg>
              </div>
              <h3 className="feature-title">List Optimizer</h3>
              <p className="feature-desc">Build a list and compare store prices — get the cheapest local store recommendations instantly.</p>
            </div>
          </div>
        </section>

        {/* Use Cases Section (Persona Grid) */}
        <section className="use-cases-section" id="use-cases">
          <div className="section-header">
            <span className="badge badge--primary section-eyebrow">USE CASES</span>
            <h2 className="section-title">Built for how you actually spend</h2>
            <p className="section-subtitle">Wobblio adapts to your lifestyle, whether you track household expenses, travel, or hunt for local savings.</p>
          </div>

          <div className="use-cases-grid">
            {PERSONAS.map(({ id, title, headline, hook, description, Icon }) => (
              <div 
                key={id} 
                className="glass use-case-card flex gap-4 p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-premium-glow"
                data-testid={`persona-${id}`}
              >
                <div className="use-case-icon-wrap flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-[8px] bg-electric-indigo/10 text-electric-indigo">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <span className="badge badge--primary" style={{ fontSize: '10px', padding: '2px 8px', marginBottom: '8px' }}>
                    {title}
                  </span>
                  <h3 className="use-case-title text-lg font-bold mt-1 text-[var(--text-primary)]">
                    {headline}
                  </h3>
                  <span className="use-case-hook text-xs italic block mt-1 text-[var(--brand)]">
                    {hook}
                  </span>
                  <p className="use-case-desc mt-2 text-sm text-[var(--text-secondary)]">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Steps Timeline Section */}
        <section className="steps-section" id="how-it-works">
          <div className="section-header">
            <span className="badge badge--primary section-eyebrow">HOW IT WORKS</span>
            <h2 className="section-title">Up and running in 3 steps</h2>
          </div>

          <div className="steps-container">
            <div className="steps-list">
              <div 
                className={`step-item ${activeStep === 1 ? 'active' : ''}`} 
                onClick={() => setActiveStep(1)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveStep(1); }}
              >
                <span className="step-num">1</span>
                <div className="step-item-content">
                  <h3>Upload a receipt</h3>
                  <p>Drag-and-drop or capture with your phone. Ingestion compiles everything in real-time.</p>
                </div>
              </div>
              <div 
                className={`step-item ${activeStep === 2 ? 'active' : ''}`} 
                onClick={() => setActiveStep(2)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveStep(2); }}
              >
                <span className="step-num">2</span>
                <div className="step-item-content">
                  <h3>AI extracts everything</h3>
                  <p>Our models normalize product names, prices, tax segments, and quantities for you.</p>
                </div>
              </div>
              <div 
                className={`step-item ${activeStep === 3 ? 'active' : ''}`} 
                onClick={() => setActiveStep(3)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveStep(3); }}
              >
                <span className="step-num">3</span>
                <div className="step-item-content">
                  <h3>Find the best deal</h3>
                  <p>Compare costs, optimize shopping lists, and choose the cheapest local stores.</p>
                </div>
              </div>
            </div>

            <div className="glass steps-visual-pane">
              {activeStep === 1 && (
                <div className="step-visual-content active" id="stepVisual1">
                  <div className="advisor-preview">
                    <div className="advisor-bubble">
                      <strong>Ingestion details:</strong> Reading layout boundaries, optimizing contrast levels, and extracting text lines...
                    </div>
                    <div className="progress-bar-bg" style={{ marginTop: '10px' }}>
                      <div className="progress-bar-fill" style={{ width: '75%' }}></div>
                    </div>
                  </div>
                </div>
              )}
              {activeStep === 2 && (
                <div className="step-visual-content active" id="stepVisual2">
                  <div className="advisor-preview">
                    <div className="badge badge--warning" style={{ marginBottom: '8px' }}>Confidence Alert (81%)</div>
                    <p style={{ fontSize: '14px', marginBottom: '12px' }}>Is <strong>&quot;Latte Macch&quot;</strong> correct for <strong>Latte Macchiato</strong>?</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Yes, Correct</button>
                      <button className="btn btn--outline" style={{ padding: '6px 12px', fontSize: '12px' }}>Edit name</button>
                    </div>
                  </div>
                </div>
              )}
              {activeStep === 3 && (
                <div className="step-visual-content active" id="stepVisual3">
                  <div className="advisor-preview">
                    <div className="advisor-bubble" style={{ background: 'var(--success-glow)', borderColor: 'rgba(13,148,136,0.15)' }}>
                      🎉 <strong>Route Insight:</strong> Swapping organic milk to Dirk saves your household <strong>€1.20</strong> on this list.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="pricing-section" id="pricing">
          <div className="section-header">
            <span className="badge badge--primary section-eyebrow">PRICING</span>
            <h2 className="section-title">Ready to start saving?</h2>
          </div>

          <div className="pricing-toggle-wrap">
            <button 
              className={`pricing-toggle-btn ${billingPeriod === 'monthly' ? 'active' : ''}`} 
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </button>
            <button 
              className={`pricing-toggle-btn ${billingPeriod === 'annual' ? 'active' : ''}`} 
              onClick={() => setBillingPeriod('annual')}
            >
              Annual (Save 20%)
            </button>
          </div>

          <div className="pricing-grid">
            {/* Free Plan */}
            <div className="glass pricing-card">
              <h3 className="pricing-title">Standard</h3>
              <p className="pricing-desc">Perfect for basic receipt tracking.</p>
              <div className="pricing-price-wrap">
                <span className="pricing-currency">€</span>
                <span className="pricing-amount">0</span>
                <span className="pricing-period">/mo</span>
              </div>
              <ul className="pricing-features-list">
                <li className="pricing-feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" strokeWidth="3"/>
                  </svg>
                  10 scans per month
                </li>
                <li className="pricing-feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" strokeWidth="3"/>
                  </svg>
                  Standard AI ingestion
                </li>
                <li className="pricing-feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" strokeWidth="3"/>
                  </svg>
                  Single user workspace
                </li>
              </ul>
              <Link 
                href={SIGNUP_URL}
                onClick={handleSignupClick}
                className="btn btn--outline mt-auto"
              >
                Get Started
              </Link>
            </div>

            {/* Premium Plan */}
            <div className="glass pricing-card premium">
              <h3 className="pricing-title">Household Pro</h3>
              <p className="pricing-desc">Complete sync for active families.</p>
              <div className="pricing-price-wrap">
                <span className="pricing-currency">€</span>
                <span 
                  className="pricing-amount transition-transform duration-150" 
                  id="premiumPrice"
                  style={{
                    transform: billingPeriod === 'annual' ? 'scale(1.1)' : 'scale(1)',
                    display: 'inline-block'
                  }}
                >
                  {billingPeriod === 'annual' ? '6.40' : '8'}
                </span>
                <span className="pricing-period" id="premiumPeriod">
                  {billingPeriod === 'annual' ? '/mo, billed annually' : '/mo'}
                </span>
              </div>
              <ul className="pricing-features-list">
                <li className="pricing-feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" strokeWidth="3"/>
                  </svg>
                  Unlimited scans
                </li>
                <li className="pricing-feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" strokeWidth="3"/>
                  </svg>
                  Shared household pool
                </li>
                <li className="pricing-feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" strokeWidth="3"/>
                  </svg>
                  List optimizer & store comparisons
                </li>
                <li className="pricing-feature-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" strokeWidth="3"/>
                  </svg>
                  WhatsApp reports & exports
                </li>
              </ul>
              <Link 
                href={`${SIGNUP_URL}?plan=premium_${billingPeriod}`}
                onClick={handleSignupClick}
                className="btn btn--primary mt-auto"
              >
                Upgrade Now
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* Global Footer */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <span className="footer-copy">© 2026 Wobblio · GDPR Compliant</span>
          <div className="footer-links">
            <a href="design-rationale.md" className="footer-link">Read Design Rationale</a>
            <a href="#" className="footer-link">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
