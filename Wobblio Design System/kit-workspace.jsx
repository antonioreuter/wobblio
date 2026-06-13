/* Wobblio workspace — dashboard shell */
const { Card: WkCard, Badge: WkBadge, Tag: WkTag, Button: WkBtn, Avatar: WkAvatar,
  WobblioLogo: WkLogo, MerchantIcon: WkMerchant, MetricCard: WkMetric, ProgressBar: WkBar } = window.WobblioDesignSystem_6a8d64;
const WI = window.WobblioIcons;

const RAIL = [
['grid', 'Dashboard'], ['receiptText', 'Invoices'], ['checkSquare', 'Awaiting Check'],
['trend', 'Price Trends'], ['cart', 'Shopping Lists'], ['wallet', 'Budgets'],
['users', 'Household'], ['settings', 'Settings'], ['terminal', 'Console']];


const SEED_INVOICES = [
{ id: 1, merchant: 'Jumbo Oostpoort', date: '12 Jun 2026', status: ['success', 'Processed'], tags: ['dinner', 'weekly'], total: '€28.74' },
{ id: 2, merchant: 'AH To Go', date: '11 Jun 2026', status: ['warning', 'Needs Review'], tags: ['commute'], total: '€12.15' },
{ id: 3, merchant: 'Tokomania', date: '09 Jun 2026', status: ['primary', 'Auto Parsed'], tags: ['pantry'], total: '€34.20' },
{ id: 4, merchant: 'Dirk van den Broek', date: '07 Jun 2026', status: ['success', 'Processed'], tags: ['weekly'], total: '€41.06' }];


const SPEND = [
['Groceries', 248.6, 150],
['Bar & Restaurants', 162.4, 98],
['Transport', 98.2, 59],
['Drugstore', 74.8, 45],
['Others', 58.3, 35]];


// Budgets share the same expense taxonomy as the spend chart.
const BUDGETS = [
{ name: 'Groceries', pct: 76, tone: 'warning' },
{ name: 'Bar & Restaurants', pct: 104, tone: 'danger' },
{ name: 'Transport', pct: 51, tone: 'success' }];

const OVER_BUDGET = BUDGETS.filter((b) => b.pct >= 100).length;

function SpendChart() {
  return (
    <WkCard className="panel">
      <div className="panel-header" style={{ marginBottom: 4 }}>
        <span className="panel-title">Spending by Category</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>June 2026</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 20 }}>How your <strong style={{ color: 'var(--text-primary)' }}>€642.30</strong> broke down across expense types.</p>
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
  const [invoices, setInvoices] = React.useState(SEED_INVOICES);
  const [refreshing, setRefreshing] = React.useState(false);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => {setInvoices(SEED_INVOICES);setRefreshing(false);}, 900);
  };
  const removeInvoice = (id) => setInvoices((list) => list.filter((x) => x.id !== id));

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
              <button className="icon-toggle" onClick={onToggleTheme} title="Toggle theme">
                {theme === 'dark' ? <WI.sun /> : <WI.moon />}
              </button>
              <div className="user-chip">
                <WkAvatar initials="AR" />
                <div className="user-meta">
                  <span className="user-name">Antonio R.</span>
                  <span className="user-plan"><WI.crown /> Premium</span>
                </div>
              </div>
            </div>
          </header>

          <div className="pane">
            <h2 className="pane-title">Your Everyday Savings</h2>
            <p className="pane-subtitle">Overview of your household expenses and price trends.</p>

            <div className="metrics-row">
              <WkMetric label="Spent This Month" value="€642.30" delta="↓ 11.8% vs €728.42 last month" tone="success" />
              <WkMetric label="Retail Deals Found" value="€24.80" delta="4 brand switches matching preferences" tone="success" />
              <WkMetric label="Needs Check" value="3 items" delta="1 receipt needs verification" tone="warning" />
            </div>

            <div className="dash-row">
              <div className="stack">
                <SpendChart />

                <WkCard className="panel" style={{ padding: 0 }}>
                  <div className="panel-header" style={{ padding: '20px 24px 0' }}>
                    <span className="panel-title">Recent Invoices</span>
                    <WkBtn variant="outline" style={{ padding: '6px 14px', fontSize: 12.5 }} onClick={refresh}
                    iconLeft={<span className={refreshing ? 'spin' : ''} style={{ display: 'flex' }}><WI.reload /></span>}>
                      {refreshing ? 'Refreshing…' : 'Refresh'}
                    </WkBtn>
                  </div>
                  <table className="app-table">
                    <thead>
                      <tr><th>Merchant</th><th>Date</th><th>Status</th><th>Tags</th><th className="num">Total</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) =>
                      <tr key={inv.id}>
                          <td><div className="merchant-cell"><WkMerchant merchant={inv.merchant} /> {inv.merchant}</div></td>
                          <td>{inv.date}</td>
                          <td><WkBadge tone={inv.status[0]}>{inv.status[1]}</WkBadge></td>
                          <td><div className="tag-row">{inv.tags.map((t) => <WkTag key={t}>{t}</WkTag>)}</div></td>
                          <td className="num">{inv.total}</td>
                          <td>
                            <div className="row-actions">
                              <button className="row-action" title="Share invoice"><WI.share /></button>
                              <button className="row-action danger" title="Delete invoice" onClick={() => removeInvoice(inv.id)}><WI.trash /></button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {invoices.length === 0 &&
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>No invoices — hit Refresh to restore.</td></tr>
                      }
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
                  <div className="panel-header" style={{ marginBottom: 4 }}>
                    <span className="panel-title">Category Budgets</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 18 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{BUDGETS.length} budgets</strong> tracked ·{' '}
                    <strong style={{ color: OVER_BUDGET ? 'var(--danger)' : 'var(--success)' }}>{OVER_BUDGET} over budget</strong>
                  </p>
                  {BUDGETS.map((b) =>
                  <div className="budget-item" key={b.name}>
                      <div className="budget-meta">
                        <span className="name">{b.name}</span>
                        <span className="pct" style={{ color: `var(--${b.tone === 'danger' ? 'danger' : b.tone === 'warning' ? 'warning' : 'success'})` }}>{b.pct}%</span>
                      </div>
                      <WkBar value={b.pct} />
                    </div>
                  )}
                </WkCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

window.WobblioWorkspace = Workspace;