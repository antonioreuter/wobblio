/* Wobblio marketing landing screen */
const { Button: WBtn, Badge: WBadge, Card: WCard } = window.WobblioDesignSystem_6a8d64;
const I = window.WobblioIcons;

function HeroMockup() {
  const [state, setState] = React.useState('idle'); // idle | scanning | done
  const items = [
    ['Organic Whole Milk 1L', '€3.89'],
    ['Free Range Eggs (12)', '€4.25'],
    ['Sourdough Bread 800g', '€2.99'],
  ];
  const run = () => {
    if (state === 'scanning') return;
    setState('scanning');
    setTimeout(() => setState('done'), 1500);
  };
  return (
    <WCard className="interactive-mockup">
      <div className="mockup-header">
        <div>
          <span className="mockup-store-name">Lidl — Lisbon Norte</span>
          <span className="mockup-date">25 May 2026</span>
        </div>
        <WBadge tone={state === 'done' ? 'success' : 'warning'}>{state === 'done' ? 'Processed' : 'Scanning'}</WBadge>
      </div>
      {state !== 'done' ? (
        <div className="upload-dropzone" onClick={run}>
          <div className="upload-icon"><I.upload size={32}/></div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {state === 'scanning' ? 'Reading receipt…' : 'Click to scan a receipt'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {state === 'scanning' ? 'AI extracting line items' : 'Simulate AI parsing instantly'}
          </p>
        </div>
      ) : (
        <div className="mockup-item-list">
          {items.map(([n, p]) => (
            <div className="mockup-item" key={n}>
              <span className="mockup-item-name">{n}</span>
              <span className="mockup-item-price">{p}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mockup-footer">
        <span className="mockup-total-label">Total</span>
        <span className="mockup-total-value">€11.13</span>
      </div>
    </WCard>
  );
}

const FEATURES = [
  { icon: 'camera', title: 'AI Ingestion', desc: 'Drag and drop receipt photos. AI extracts merchant names, product descriptions, quantities, and prices in seconds.' },
  { icon: 'trend', title: 'Price Trends', desc: 'Interactive charts show how your everyday items fluctuate across local chains over time.' },
  { icon: 'box', title: 'List Optimizer', desc: 'Build a list and compare store prices — get the cheapest local store recommendations instantly.' },
];

const USE_CASES = [
  { icon: 'users', title: 'One family, one picture of the money', hook: '"Alerts before the budget breaks — not a post-mortem after."', desc: 'Share uploads across household members. Track combined totals and trigger warnings before you overspend.' },
  { icon: 'trend', title: 'Inflation is personal', hook: '"See exactly which store raised which price — and shop around with proof."', desc: 'Map price details across brands and chains. Watch charts creep up and find where items are cheapest.' },
  { icon: 'split', title: 'One photo. Tap who had what', hook: '"Fair split — including the tip — in your group chat in 30 seconds."', desc: 'Split restaurant bills proportionally. Allocates service and tip automatically, then exports to WhatsApp.' },
  { icon: 'globe', title: 'Three countries, one budget', hook: '"Every receipt converted on the day you paid — not when your bank felt like it."', desc: 'Scan foreign receipts on the go. Converts currencies on the transaction date, with zero bank lag.' },
];

function Landing({ onStart, onLogin }) {
  return (
    <div>
      <section className="hero-section">
        <div className="hero-content">
          <WBadge tone="primary">Smart Expense Ingestion</WBadge>
          <h1 className="hero-title">Scan your receipts. Outsmart inflation.</h1>
          <p className="hero-description">
            Wobblio reads any receipt with AI — automatic expense tracking, real local price comparison, and
            shopping lists that know the cheapest store. No bank access. Ever.
          </p>
          <div className="hero-actions">
            <WBtn variant="primary" size="lg" iconRight={<I.arrow/>} onClick={onStart}>Start Ingesting Free</WBtn>
          </div>
          <div className="landing-stats-grid">
            {[['OCR Scan Speed', '< 8 sec'], ['Privacy Level', '100% Private'], ['GDPR Status', 'Fully Ready']].map(([l, v]) => (
              <WCard className="landing-stat-card" key={l}>
                <div className="landing-stat-label">{l}</div>
                <div className="landing-stat-value">{v}</div>
              </WCard>
            ))}
          </div>
        </div>
        <div className="hero-visual"><HeroMockup/></div>
      </section>

      <section className="trust-strip">
        <div className="trust-strip-inner">
          <div className="trust-item"><I.shieldCheck/> No bank connection required</div>
          <div className="trust-item"><I.calendar/> GDPR-compliant, EU-hosted, delete anytime</div>
          <div className="trust-item"><I.lock/> Only anonymized prices are ever shared</div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <WBadge tone="primary">Capabilities</WBadge>
          <h2 className="section-title">Designed for household intelligence</h2>
          <p className="section-subtitle">From AI extraction to price trends — the entire flow runs automatically.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f) => {
            const Ico = I[f.icon];
            return (
              <WCard interactive className="feature-card" key={f.title}>
                <div className="feature-icon"><Ico size={24}/></div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </WCard>
            );
          })}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-header">
          <WBadge tone="primary">Use Cases</WBadge>
          <h2 className="section-title">Built for how you actually spend</h2>
          <p className="section-subtitle">Wobblio adapts to your lifestyle — household, travel, or local savings hunting.</p>
        </div>
        <div className="use-cases-grid">
          {USE_CASES.map((u) => {
            const Ico = I[u.icon];
            return (
              <WCard interactive className="use-case-card" key={u.title}>
                <div className="use-case-icon"><Ico size={22}/></div>
                <div>
                  <div className="use-case-title">{u.title}</div>
                  <span className="use-case-hook">{u.hook}</span>
                  <div className="use-case-desc">{u.desc}</div>
                </div>
              </WCard>
            );
          })}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0, textAlign: 'center' }}>
        <div className="section-header">
          <WBadge tone="primary">Pricing</WBadge>
          <h2 className="section-title">Ready to start saving?</h2>
        </div>
        <div className="pricing-grid">
          <WCard className="pricing-card">
            <h3 className="pricing-title">Standard</h3>
            <p className="pricing-desc">Perfect for basic receipt tracking.</p>
            <div className="pricing-price"><span className="pricing-currency">€</span><span className="pricing-amount">0</span><span className="pricing-period">/mo</span></div>
            <ul className="pricing-features">
              <li><I.check/> 10 scans per month</li>
              <li><I.check/> Standard AI ingestion</li>
              <li><I.check/> Single-user workspace</li>
            </ul>
            <WBtn variant="outline" onClick={onStart}>Get Started</WBtn>
          </WCard>
          <WCard className="pricing-card premium">
            <h3 className="pricing-title">Household Pro</h3>
            <p className="pricing-desc">Complete sync for active families.</p>
            <div className="pricing-price"><span className="pricing-currency">€</span><span className="pricing-amount">8</span><span className="pricing-period">/mo</span></div>
            <ul className="pricing-features">
              <li><I.check/> Unlimited scans</li>
              <li><I.check/> Shared household pool</li>
              <li><I.check/> List optimizer &amp; store comparisons</li>
              <li><I.check/> WhatsApp reports &amp; exports</li>
            </ul>
            <WBtn variant="primary" onClick={onStart}>Upgrade Now</WBtn>
          </WCard>
        </div>
      </section>
    </div>
  );
}

window.WobblioLanding = Landing;
