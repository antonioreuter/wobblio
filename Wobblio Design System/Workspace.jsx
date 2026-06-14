/* Wobblio workspace — dashboard shell */
const { Card: WkCard, Badge: WkBadge, Tag: WkTag, Button: WkBtn, Avatar: WkAvatar,
  WobblioLogo: WkLogo, MerchantIcon: WkMerchant, MetricCard: WkMetric, ProgressBar: WkBar } = window.WobblioDesignSystem_6a8d64;
const WI = window.WobblioIcons;

const RAIL = [
['grid', 'Dashboard'], ['receiptText', 'Invoices'], ['checkSquare', 'Awaiting Check'],
['trend', 'Price Trends'], ['cart', 'Shopping Lists'], ['wallet', 'Budgets'],
['users', 'Household'], ['settings', 'Settings'], ['terminal', 'Console']];


const INVOICES = [
{ merchant: 'Jumbo Oostpoort', date: '12 Jun 2026', status: ['success', 'Processed'], tags: ['dinner', 'weekly'], total: '€28.74' },
{ merchant: 'AH To Go', date: '11 Jun 2026', status: ['warning', 'Needs Review'], tags: ['commute'], total: '€12.15' },
{ merchant: 'Tokomania', date: '09 Jun 2026', status: ['primary', 'Auto Parsed'], tags: ['pantry'], total: '€34.20' },
{ merchant: 'Dirk van den Broek', date: '07 Jun 2026', status: ['success', 'Processed'], tags: ['weekly'], total: '€41.06' }];


const SPEND = [
['Groceries', 248.6, 150],
['Bar & Restaurants', 162.4, 98],
['Transport', 98.2, 59],
['Drugstore', 74.8, 45],
['Others', 58.3, 35]];


function SpendChart() {
  return (
    <WkCard className="panel">
      <div className="panel-header" style={{ marginBottom: 4 }}>
        <span className="panel-title">Spending by Category</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>June 2026</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 20 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>€642.30</span> total spent this month
      </p>
      <div className="spend-chart">
        {SPEND.map(([label, val, h]) =>
        <div className="spend-col" key={label}>
            <div className="spend-val">€{Math.round(val)}</div>
            <div className="spend-bar" style={{ height: h }} title={`${label}: €${val.toFixed(2)}`} />
            <div className="spend-label">{label}</div>
          </div>
        )}
      </div>
    </WkCard>);

}

function Workspace({ theme, onToggleTheme }) {
  const [active, setActive] = React.useState(0);
  const [rls, setRls] = React.useState(true);
  const [bannerOpen, setBannerOpen] = React.useState(false);

  const toggleRls = () => {
    const next = !rls;
    setRls(next);
    setBannerOpen(!next);
  };

  return (
    <div className="workspace">
      <div className="app-shell">
        <aside className="app-rail">
          <div className="rail-logo"><WkLogo size={30} /></div>
          <nav className="rail-menu">
            {RAIL.map(([icon, label], i) => {
              const Ico = WI[icon];
              return (
                <button key={label} title={label} className={`rail-btn ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
                  <Ico size={20} />
                </button>);

            })}
          </nav>
        </aside>

        <div className="app-body">
          <header className="app-topbar">
            <div className="search-wrap">
              <WI.search />
              <input className="app-search" placeholder="Search merchant, tag, or item…" />
            </div>
            <div className="topbar-right">
              <button className="dev-btn" title="Reload seed data"><WI.reload /> Reload Seeds</button>
              <button className={`dev-btn ${rls ? 'rls-on' : 'rls-off'}`} onClick={toggleRls} title="Toggle PostgreSQL RLS">
                <WI.shield size={13} /> {rls ? 'RLS: Enforced' : 'RLS: Bypassed'}
              </button>
              <span className="quota">7 of 10 scans used</span>
              <button className="icon-toggle" onClick={onToggleTheme} title="Toggle theme">
                {theme === 'dark' ? <WI.sun /> : <WI.moon />}
              </button>
              <WkAvatar initials="AR" />
            </div>
          </header>

          {bannerOpen &&
          <div className="rls-banner">
              <WI.alert />
              <span className="msg"><strong>PostgreSQL tenant separation bypass warning:</strong> Query attempted to access data from user <code>usr_9a4f210e</code>. Operation blocked by RLS policies.</span>
              <button onClick={() => setBannerOpen(false)} aria-label="Dismiss">×</button>
            </div>
          }

          <div className="pane">
            <h2 className="pane-title">Your Everyday Savings</h2>
            <p className="pane-subtitle">Overview of your household expenses and price trends.</p>

            <div className="metrics-row">
              <WkMetric label="Total Tracked Spend" value="€642.30" delta="↓ €86.12 below projection" tone="success" />
              <WkMetric label="Retail Deals Found" value="€24.80" delta="4 brand switches matching preferences" tone="success" />
              <WkMetric label="Needs Check" value="3 items" delta="1 receipt needs verification" tone="warning" />
            </div>

            <div className="dash-row">
              <div className="stack">
                <SpendChart />

                <WkCard className="panel" style={{ padding: 0 }}>
                  <div className="panel-header" style={{ padding: '20px 24px 0' }}>
                    <span className="panel-title">Recent Invoices</span>
                    <WkBtn variant="outline" style={{ padding: '6px 14px', fontSize: 12.5 }}>Bulk Categorize</WkBtn>
                  </div>
                  <table className="app-table">
                    <thead>
                      <tr><th>Merchant</th><th>Date</th><th>Status</th><th>Tags</th><th className="num">Total</th></tr>
                    </thead>
                    <tbody>
                      {INVOICES.map((inv) =>
                      <tr key={inv.merchant}>
                          <td><div className="merchant-cell"><WkMerchant merchant={inv.merchant} /> {inv.merchant}</div></td>
                          <td>{inv.date}</td>
                          <td><WkBadge tone={inv.status[0]}>{inv.status[1]}</WkBadge></td>
                          <td><div className="tag-row">{inv.tags.map((t) => <WkTag key={t}>{t}</WkTag>)}</div></td>
                          <td className="num">{inv.total}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </WkCard>
              </div>

              <div className="stack">
                <WkCard className="upload-dropzone" style={{ padding: '28px 20px' }}>
                  <div className="upload-icon"><WI.upload size={26} /></div>
                  <h3 style={{ fontSize: 15, marginBottom: 4, color: 'var(--text-primary)' }}>Upload New Receipt</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Drag and drop a receipt (PNG, JPG, PDF), or <span style={{ color: 'var(--brand)', textDecoration: 'underline' }}>browse files</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Location metadata removed · compressed client-side.</p>
                </WkCard>

                <WkCard className="panel">
                  <div className="panel-header" style={{ marginBottom: 12 }}>
                    <span className="panel-title">Category Budgets</span>
                  </div>
                  <div className="budget-item">
                    <div className="budget-meta"><span className="name">Fresh Food</span><span className="pct" style={{ color: 'var(--warning)' }}>76%</span></div>
                    <WkBar value={76} />
                  </div>
                  <div className="budget-item">
                    <div className="budget-meta"><span className="name">Dining Out</span><span className="pct" style={{ color: 'var(--danger)' }}>88%</span></div>
                    <WkBar value={88} />
                  </div>
                  <div className="budget-item">
                    <div className="budget-meta"><span className="name">Utilities / Fuel</span><span className="pct" style={{ color: 'var(--success)' }}>51%</span></div>
                    <WkBar value={51} />
                  </div>
                </WkCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

window.WobblioWorkspace = Workspace;