/* Wobblio workspace — dashboard + invoices */
const { Card: WkCard, Badge: WkBadge, Tag: WkTag, Button: WkBtn, Avatar: WkAvatar,
        WobblioLogo: WkLogo, MerchantIcon: WkMerchant, MetricCard: WkMetric, ProgressBar: WkBar } = window.WobblioDesignSystem_6a8d64;
const WI = window.WobblioIcons;

const RAIL = [
  ['grid', 'Dashboard'], ['receiptText', 'Invoices'], ['checkSquare', 'Awaiting Check'],
  ['trend', 'Price Trends'], ['cart', 'Shopping Lists'], ['wallet', 'Budgets'],
  ['users', 'Household'], ['settings', 'Settings'], ['terminal', 'Console'],
];

const CATEGORIES = ['Groceries', 'Bar & Restaurants', 'Transport', 'Drugstore', 'Others'];
const MERCHANTS = ['Albert Heijn', 'AH To Go', 'Jumbo Oostpoort', 'Dirk van den Broek', 'Lidl', 'Tokomania', 'Restaurante Cantinho'];
const STATUSES = [['success', 'Processed'], ['warning', 'Needs Review'], ['primary', 'Auto Parsed']];
const TODAY = new Date('2026-06-13');

// Full ledger, generated deterministically so "Load more" has real depth.
const TAG_POOL = ['dinner', 'weekly', 'commute', 'pantry', 'treat', 'household', 'fuel', 'organic'];
const ALL_TAGS = TAG_POOL;
function buildInvoices() {
  const out = [];
  let day = 1;
  for (let k = 0; k < 42; k++) {
    const d = new Date(TODAY); d.setDate(d.getDate() - day);
    const tags = [...new Set([TAG_POOL[k % TAG_POOL.length], TAG_POOL[(k * 2 + 1) % TAG_POOL.length]])];
    out.push({
      id: k + 1,
      merchant: MERCHANTS[(k * 3) % MERCHANTS.length],
      category: CATEGORIES[k % CATEGORIES.length],
      dateISO: d.toISOString().slice(0, 10),
      status: STATUSES[k % STATUSES.length],
      tags,
      total: Math.round((8 + ((k * 7.37) % 72)) * 100) / 100,
    });
    day += 1 + (k % 3);
  }
  return out;
}
const INVOICE_DB = buildInvoices();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const eur = (n) => '€' + n.toFixed(2);
const daysAgo = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; };

const SPEND = [
  ['Groceries', 248.6, 150], ['Bar & Restaurants', 162.4, 98], ['Transport', 98.2, 59],
  ['Drugstore', 74.8, 45], ['Others', 58.3, 35],
];

const BUDGETS = [
  { name: 'Groceries', pct: 76 }, { name: 'Bar & Restaurants', pct: 104 },
  { name: 'Transport', pct: 51 }, { name: 'Drugstore', pct: 88 },
];
const budgetColor = (pct) => pct >= 100 ? 'danger' : pct >= 85 ? 'warning' : 'success';
const BUDGET_TOTAL = BUDGETS.length;
const BUDGET_NEAR = BUDGETS.filter((b) => b.pct >= 85 && b.pct < 100).length;
const OVER_BUDGET = BUDGETS.filter((b) => b.pct >= 100).length;
const INVOICES_THIS_WEEK = 9;
const WEEKLY_LIMIT = 15;

/* ---- Shared invoice table (used by Dashboard + Invoices) ---- */
function InvoiceTable({ invoices, onRemove, onOpen, onRequestDelete, onShare, loading, skeletonRows = 5 }) {
  return (
    <div className="table-scroll">
    <table className="app-table">
      <thead>
        <tr><th>Merchant</th><th className="col-cat">Category</th><th>Date</th><th>Status</th><th className="col-tags">Tags</th><th className="num">Total</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
      </thead>
      <tbody>
        {loading && Array.from({ length: skeletonRows }).map((_, i) => (
          <tr key={`sk-${i}`} className="skeleton-row">
            <td><div className="merchant-cell"><span className="sk sk-avatar"/> <span className="sk sk-line" style={{ width: 120 }}/></div></td>
            <td className="col-cat"><span className="sk sk-line" style={{ width: 80 }}/></td>
            <td><span className="sk sk-line" style={{ width: 78 }}/></td>
            <td><span className="sk sk-pill"/></td>
            <td className="col-tags"><span className="sk sk-line" style={{ width: 60 }}/></td>
            <td className="num"><span className="sk sk-line" style={{ width: 52, marginLeft: 'auto' }}/></td>
            <td><span className="sk sk-line" style={{ width: 48, marginLeft: 'auto' }}/></td>
          </tr>
        ))}
        {!loading && invoices.map((inv) => (
          <tr key={inv.id} onClick={() => onOpen && onOpen(inv)}>
            <td><div className="merchant-cell"><span className="m-icon"><WkMerchant merchant={inv.merchant}/></span> <span className="m-name">{inv.merchant}</span></div></td>
            <td className="col-cat">{inv.category}</td>
            <td>{fmtDate(inv.dateISO)}</td>
            <td><WkBadge tone={inv.status[0]}>{inv.status[1]}</WkBadge></td>
            <td className="col-tags"><div className="tag-row">{inv.tags.map((t) => <WkTag key={t}>{t}</WkTag>)}</div></td>
            <td className="num">{eur(inv.total)}</td>
            <td>
              <div className="row-actions">
                <button className="row-action" title="Share invoice" onClick={(e) => { e.stopPropagation(); onShare && onShare(inv); }}><WI.share/></button>
                <button className="row-action danger" title="Delete invoice" onClick={(e) => { e.stopPropagation(); onRequestDelete(inv); }}><WI.trash/></button>
              </div>
            </td>
          </tr>
        ))}
        {!loading && invoices.length === 0 && (
          <tr><td colSpan={7}>
            <div className="table-empty">
              <WI.receiptText size={26}/>
              <span>No invoices match your selected filters.</span>
            </div>
          </td></tr>
        )}
      </tbody>
    </table>
    </div>
  );
}

/* ---- Styled filter select ---- */
function FilterSelect({ label, icon, value, onChange, children }) {
  return (
    <div className="filter-field">
      <label className="filter-label">{label}</label>
      <div className="filter-wrap">
        {icon && <span className="lead-icon">{icon}</span>}
        <select className="filter-select" value={value} onChange={onChange}>{children}</select>
        <span className="chevron"><WI.chevronDown/></span>
      </div>
    </div>
  );
}

/* ---- Dashboard pane ---- */
function SpendChart() {
  return (
    <WkCard className="panel">
      <div className="panel-header" style={{ marginBottom: 4 }}>
        <span className="panel-title">Spending by Category</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>June 2026</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 20 }}>How your <strong style={{ color: 'var(--text-primary)' }}>€642.30</strong> broke down across expense types.</p>
      <div className="spend-chart">
        {SPEND.map(([label, val, h]) => (
          <div className="spend-col" key={label}>
            <div className="spend-val">€{Math.round(val)}</div>
            <div className="spend-bar" style={{ height: h }} title={`${label}: €${val.toFixed(2)}`} />
            <div className="spend-label">{label}</div>
          </div>
        ))}
      </div>
    </WkCard>
  );
}

function DashboardPane({ invoices, onRemove, onOpen, onRequestDelete, onShare, onScan, onViewAll, loading, refreshing, onRefresh }) {
  return (
    <div className="pane">
      <h2 className="pane-title">Your Everyday Savings</h2>
      <p className="pane-subtitle">Overview of your household expenses and price trends.</p>

      <div className="metrics-row">
        {loading ? (
          [0,1,2].map((i) => (
            <div className="glass" style={{ padding: 'var(--space-5)' }} key={i}>
              <span className="sk sk-line" style={{ width: 90, height: 11 }}/>
              <span className="sk sk-line" style={{ width: 120, height: 26, margin: '12px 0 8px' }}/>
              <span className="sk sk-line" style={{ width: 140, height: 10 }}/>
            </div>
          ))
        ) : (
          <>
            <WkMetric label="Spent This Month" value="€642.30" delta="↓ 11.8% vs €728.42 last month" tone="success"/>
            <WkMetric label="Needs Check" value="3 items" delta="1 receipt needs verification" tone="warning"/>
            <WkMetric label="Processed This Month" value="24" delta="receipts scanned in June" tone="neutral"/>
          </>
        )}
      </div>

      <div className="dash-row">
        <div className="stack">
          <SpendChart/>
          <WkCard className="panel" style={{ padding: 0 }}>
            <div className="panel-header" style={{ padding: '20px 24px 0' }}>
              <span className="panel-title">Recent Invoices</span>
              <div className="panel-actions">
                <WkBtn variant="outline" className="refresh-btn" style={{ padding: '6px 14px', fontSize: 12.5 }} onClick={onRefresh}
                       iconLeft={<span className={`refresh-ico ${refreshing ? 'spin' : ''}`} style={{ display: 'flex' }}><WI.reload/></span>}>
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </WkBtn>
                <WkBtn variant="primary" style={{ padding: '6px 14px', fontSize: 12.5 }} onClick={onViewAll}
                       iconRight={<WI.arrow/>}>View all</WkBtn>
              </div>
            </div>
            <InvoiceTable invoices={invoices.slice(0, 4)} loading={loading} skeletonRows={4} onRemove={onRemove} onOpen={onOpen} onRequestDelete={onRequestDelete} onShare={onShare}/>
          </WkCard>
        </div>

        <div className="stack">
          <WkCard className="upload-dropzone" style={{ padding: '28px 20px', cursor: 'pointer' }} onClick={onScan}>
            <div className="upload-icon"><WI.upload size={26}/></div>
            <h3 style={{ fontSize: 15, marginBottom: 4, color: 'var(--text-primary)' }}>Upload New Receipt</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Drag and drop a receipt (PNG, JPG, PDF), or <span style={{ color: 'var(--brand)', textDecoration: 'underline' }}>browse files</span>
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Location metadata removed · compressed client-side.</p>
          </WkCard>
          <WkCard className="panel budget-tones">
            <div className="panel-header" style={{ marginBottom: 4 }}><span className="panel-title">Category Budgets</span></div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 18 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{BUDGETS.length} budgets</strong> tracked ·{' '}
              <strong style={{ color: OVER_BUDGET ? 'var(--danger)' : 'var(--success)' }}>{OVER_BUDGET} over budget</strong>
            </p>
            {BUDGETS.map((b) => (
              <div className="budget-item" key={b.name}>
                <div className="budget-meta"><span className="name">{b.name}</span><span className="pct" style={{ color: `var(--${budgetColor(b.pct)})` }}>{b.pct}%</span></div>
                <WkBar value={b.pct} tone={budgetColor(b.pct)}/>
              </div>
            ))}
          </WkCard>
        </div>
      </div>
    </div>
  );
}

/* ---- Invoices pane ---- */
const PRESETS = [
  ['30d', 'Last 30 days'], ['month', 'This month'], ['90d', 'Last 3 months'], ['custom', 'Custom range'],
];
const BLANK = { category: 'all', merchant: 'all', preset: '90d', status: 'all', from: '', to: '', tags: [] };
const PAGE_SIZE = 8;

function InvoicesPane({ invoices, onRemove, onOpen, onRequestDelete, onShare, loading }) {
  const [draft, setDraft] = React.useState(BLANK);
  const [searching, setSearching] = React.useState(false);
  const [visible, setVisible] = React.useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const toggleTag = (t) => setDraft((d) => ({ ...d, tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] }));

  // 3-month cap on custom range.
  const rangeDays = (draft.from && draft.to) ? Math.round((new Date(draft.to) - new Date(draft.from)) / 86400000) : 0;
  const rangeInvalid = draft.preset === 'custom' && draft.from && draft.to && (rangeDays < 0 || rangeDays > 92);

  const inPreset = (iso) => {
    const d = new Date(iso);
    if (draft.preset === '30d') return d >= daysAgo(30);
    if (draft.preset === 'month') return d.getUTCMonth() === TODAY.getUTCMonth() && d.getUTCFullYear() === TODAY.getUTCFullYear();
    if (draft.preset === '90d') return d >= daysAgo(92);
    if (draft.preset === 'custom') {
      if (rangeInvalid || !draft.from || !draft.to) return true;
      return d >= new Date(draft.from) && d <= new Date(draft.to);
    }
    return true;
  };

  const filtered = invoices.filter((inv) =>
    (draft.category === 'all' || inv.category === draft.category) &&
    (draft.merchant === 'all' || inv.merchant === draft.merchant) &&
    (draft.status === 'all' || inv.status[1] === draft.status) &&
    (draft.tags.length === 0 || draft.tags.some((t) => inv.tags.includes(t))) &&
    inPreset(inv.dateISO)
  );

  const activeCount = (draft.category !== 'all') + (draft.merchant !== 'all') + (draft.status !== 'all') + (draft.preset !== '90d') + (draft.tags.length > 0);
  const search = () => { setSearching(true); setTimeout(() => setSearching(false), 550); };

  // Reset paging whenever the filter set changes.
  React.useEffect(() => { setVisible(PAGE_SIZE); }, [draft]);
  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;
  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setTimeout(() => { setVisible((v) => v + PAGE_SIZE); setLoadingMore(false); }, 500);
  };

  return (
    <div className="pane">
      <h2 className="pane-title">Invoices</h2>
      <p className="pane-subtitle">View, filter and manage all your scanned receipts.</p>

      <WkCard className="panel filter-card">
        <div className="filter-head"><WI.search size={15}/> <span>Filter invoices</span></div>
        <div className="filter-grid">
          <FilterSelect label="Expense category" icon={<WI.box size={15}/>} value={draft.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </FilterSelect>
          <FilterSelect label="Merchant" icon={<WI.cart size={15}/>} value={draft.merchant} onChange={(e) => set({ merchant: e.target.value })}>
            <option value="all">All merchants</option>
            {MERCHANTS.map((m) => <option key={m} value={m}>{m}</option>)}
          </FilterSelect>
          <FilterSelect label="Date range" icon={<WI.calendar size={15}/>} value={draft.preset} onChange={(e) => set({ preset: e.target.value })}>
            {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FilterSelect>
          <FilterSelect label="Status" icon={<WI.shield size={15}/>} value={draft.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="all">Any status</option>
            {STATUSES.map(([, l]) => <option key={l} value={l}>{l}</option>)}
          </FilterSelect>
        </div>

        {draft.preset === 'custom' && (
          <div className="filter-grid filter-dates">
            <div className="filter-field">
              <label className="filter-label">From</label>
              <div className="filter-wrap"><span className="lead-icon"><WI.calendar size={15}/></span>
                <input type="date" className="filter-select" value={draft.from} max={draft.to || undefined} onChange={(e) => set({ from: e.target.value })}/></div>
            </div>
            <div className="filter-field">
              <label className="filter-label">To</label>
              <div className="filter-wrap"><span className="lead-icon"><WI.calendar size={15}/></span>
                <input type="date" className="filter-select" value={draft.to} min={draft.from || undefined} onChange={(e) => set({ to: e.target.value })}/></div>
            </div>
          </div>
        )}

        <div className="filter-field" style={{ marginTop: 16 }}>
          <label className="filter-label">Tags</label>
          <div className="filter-tags">
            {ALL_TAGS.map((t) => (
              <button key={t} type="button" className={`filter-chip ${draft.tags.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(t)}>{t}</button>
            ))}
          </div>
        </div>

        <div className="filter-foot">
          <span className={`filter-hint ${rangeInvalid ? 'invalid' : ''}`}>
            <WI.clock size={13}/>
            {rangeInvalid ? 'Range can’t exceed 3 months.' : 'Maximum range: 3 months.'}
          </span>
          <div className="filter-actions">
            <button className="btn btn--text" style={{ padding: '8px 14px' }} onClick={() => setDraft(BLANK)}><WI.trash size={14}/> Clear filters</button>
            <WkBtn variant="primary" disabled={rangeInvalid} style={{ padding: '9px 20px', fontSize: 13 }} onClick={search}
                   iconLeft={searching ? null : <WI.search size={15}/>}>
              {searching ? 'Searching…' : 'Search'}
            </WkBtn>
          </div>
        </div>
      </WkCard>

      <WkCard className="panel" style={{ padding: 0 }}>
        <div className="panel-header" style={{ padding: '20px 24px 0' }}>
          <span className="panel-title">All invoices <span className="count-pill">{filtered.length}</span></span>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Showing {shown.length} of {filtered.length}</span>
        </div>
        <InvoiceTable invoices={shown} loading={loading} skeletonRows={8} onRemove={onRemove} onOpen={onOpen} onRequestDelete={onRequestDelete} onShare={onShare}/>
        {remaining > 0 && (
          <div className="load-more">
            <button className="load-more-btn" onClick={loadMore} disabled={loadingMore}>
              {loadingMore
                ? <><span className="spin" style={{ display: 'flex' }}><WI.reload/></span> Loading…</>
                : <><WI.chevronDown size={15}/> Load {Math.min(PAGE_SIZE, remaining)} more</>}
            </button>
          </div>
        )}
        <div className="table-foot"><WI.shieldCheck size={14}/> Your data is private and secure.</div>
      </WkCard>
    </div>
  );
}

/* ---- Price Trends pane ---- */
const MERCHANT_SHORT = {
  'Albert Heijn': 'AH', 'AH To Go': 'AH To Go', 'Jumbo Oostpoort': 'Jumbo',
  'Dirk van den Broek': 'Dirk', 'Lidl': 'Lidl', 'Tokomania': 'Tokomania', 'Restaurante Cantinho': 'Cantinho',
};
// Each product is sold by several merchants — one line per product × merchant.
const TREND_PRODUCTS = [
  { id: 'milk',    name: 'Organic Whole Milk 1L', short: 'Milk',    stores: [['Albert Heijn', 1.29], ['Jumbo Oostpoort', 1.19], ['Lidl', 1.05]] },
  { id: 'coffee',  name: 'Arabica Coffee 1kg',    short: 'Coffee',  stores: [['Albert Heijn', 9.49], ['Jumbo Oostpoort', 8.99], ['Dirk van den Broek', 8.45]] },
  { id: 'eggs',    name: 'Free-Range Eggs (12)',  short: 'Eggs',    stores: [['Albert Heijn', 3.59], ['Jumbo Oostpoort', 3.39]] },
  { id: 'bread',   name: 'Sourdough Bread 800g',  short: 'Bread',   stores: [['Jumbo Oostpoort', 2.79], ['Lidl', 2.45]] },
  { id: 'bananas', name: 'Bananas 1kg',           short: 'Bananas', stores: [['Albert Heijn', 1.79], ['Lidl', 1.49]] },
  { id: 'chicken', name: 'Chicken Breast 500g',   short: 'Chicken', stores: [['Albert Heijn', 4.49], ['Dirk van den Broek', 3.95]] },
  { id: 'oil',     name: 'Olive Oil 500ml',       short: 'Olive Oil', stores: [['Jumbo Oostpoort', 6.49], ['Lidl', 5.79]] },
  { id: 'cheese',  name: 'Gouda Cheese 400g',     short: 'Gouda',   stores: [['Albert Heijn', 4.15], ['Jumbo Oostpoort', 3.95], ['Dirk van den Broek', 3.79]] },
];
const SERIES_COLORS = ['#6366f1', '#0d9488', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#22c55e', '#ec4899', '#eab308'];
const MAX_PRODUCTS = 3;

// 26 weekly sample dates ending today — enough history for any preset within 3 months.
const TREND_WEEKS = (() => {
  const out = [];
  for (let i = 25; i >= 0; i--) { const d = new Date(TODAY); d.setDate(d.getDate() - i * 7); out.push(d); }
  return out;
})();
const weeklySeries = (base, seed) => TREND_WEEKS.map((d, i) => {
  const drift = 1 + (0.01 + (seed % 3) * 0.008) * (i / 25);
  const wave = Math.sin((i + seed) * 0.5) * base * 0.015;
  return Math.round((base * drift + wave) * 100) / 100;
});
// Precompute a full series per product|merchant line.
const TREND_DATA = {};
TREND_PRODUCTS.forEach((pr, p) => pr.stores.forEach(([m, price], s) => {
  TREND_DATA[`${pr.id}|${m}`] = weeklySeries(price, p * 3 + s);
}));

function LineChart({ series, months }) {
  const [hover, setHover] = React.useState(null);
  const W = 760, H = 320, padL = 46, padR = 18, padT = 18, padB = 36;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = months.length;
  const all = series.flatMap((s) => s.data);
  const lo = Math.min(...all), hi = Math.max(...all);
  const yMin = Math.max(0, lo - (hi - lo) * 0.15 - 0.05), yMax = hi + (hi - lo) * 0.15 + 0.05;
  const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, k) => yMin + ((yMax - yMin) * k) / ticks);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let i = Math.round(((px - padL) / plotW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  };

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Price timeline">
        {gridVals.map((v, k) => (
          <g key={k}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} className="chart-grid"/>
            <text x={padL - 8} y={y(v) + 4} className="chart-ylabel">€{v.toFixed(2)}</text>
          </g>
        ))}
        {months.map((m, i) => ((i % 2 === 0) || i === n - 1) && (
          <text key={i} x={x(i)} y={H - 12} className="chart-xlabel">{m}</text>
        ))}
        {series.map((s) => (
          <polyline key={s.id} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
                    points={s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ')}/>
        ))}
        {hover != null && (
          <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + plotH} className="chart-cross"/>
        )}
        {hover != null && series.map((s) => (
          <circle key={s.id} cx={x(hover)} cy={y(s.data[hover])} r="4" fill="var(--bg-color)" stroke={s.color} strokeWidth="2.5"/>
        ))}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent"
              onMouseMove={onMove} onMouseLeave={() => setHover(null)}/>
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="chart-tip-head">{months[hover]}</div>
          {series.map((s) => (
            <div className="chart-tip-row" key={s.id}>
              <span className="dot" style={{ background: s.color }}/>
              <span className="nm">{s.name}</span>
              <span className="vl">€{s.data[hover].toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Typeahead product search — types to filter; we never load a full combobox. */
function ProductSearch({ onAdd, disabled, exclude }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const query = q.trim().toLowerCase();
  const matches = query
    ? TREND_PRODUCTS.filter((p) => !exclude.includes(p.id) && (p.name.toLowerCase().includes(query) || p.short.toLowerCase().includes(query))).slice(0, 8)
    : [];
  const pick = (p) => { onAdd(p.id); setQ(''); setOpen(false); };
  return (
    <div className="filter-field typeahead-field">
      <label className="filter-label">Find a product</label>
      <div className="filter-wrap">
        <span className="lead-icon"><WI.search size={15}/></span>
        <input className="filter-select ta-input" type="text" disabled={disabled}
               placeholder={disabled ? `Maximum of ${MAX_PRODUCTS} products` : 'Type a product name…'}
               value={q}
               onChange={(e) => { setQ(e.target.value); setOpen(true); }}
               onFocus={() => setOpen(true)}
               onBlur={() => setTimeout(() => setOpen(false), 150)}
               onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); pick(matches[0]); } }}/>
      </div>
      {open && !disabled && query && (
        <div className="typeahead">
          {matches.length === 0
            ? <div className="typeahead-empty">No products match “{q}”.</div>
            : matches.map((p) => (
                <button key={p.id} type="button" className="typeahead-opt" onMouseDown={(e) => { e.preventDefault(); pick(p); }}>
                  <span className="ta-name">{p.name}</span>
                  <span className="ta-stores">{p.stores.length} stores</span>
                </button>
              ))}
        </div>
      )}
    </div>
  );
}

function PriceTrendsPane() {
  const [selected, setSelected] = React.useState(['milk']);
  const [preset, setPreset] = React.useState('90d');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [searching, setSearching] = React.useState(false);

  const atMax = selected.length >= MAX_PRODUCTS;

  // One line per product × merchant (no line cap).
  const lines = [];
  selected.forEach((id) => {
    const pr = TREND_PRODUCTS.find((p) => p.id === id);
    pr.stores.forEach(([m]) => lines.push({
      id: `${id}|${m}`, product: pr.short, merchant: MERCHANT_SHORT[m] || m,
      name: `${pr.short} · ${MERCHANT_SHORT[m] || m}`, full: TREND_DATA[`${id}|${m}`],
    }));
  });

  // 3-month cap on a custom range.
  const rangeDays = (from && to) ? Math.round((new Date(to) - new Date(from)) / 86400000) : 0;
  const rangeInvalid = preset === 'custom' && from && to && (rangeDays < 0 || rangeDays > 92);

  const inRange = (d) => {
    if (preset === '30d') return d >= daysAgo(30);
    if (preset === 'month') return d.getUTCMonth() === TODAY.getUTCMonth() && d.getUTCFullYear() === TODAY.getUTCFullYear();
    if (preset === 'custom' && !rangeInvalid && from && to) return d >= new Date(from) && d <= new Date(to);
    return d >= daysAgo(92);
  };
  const idx = TREND_WEEKS.map((d, i) => [d, i]).filter(([d]) => inRange(d)).map(([, i]) => i);
  const labels = idx.map((i) => { const d = TREND_WEEKS[i]; return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; });
  const series = lines.map((ln, i) => ({ ...ln, color: SERIES_COLORS[i % SERIES_COLORS.length], data: idx.map((j) => ln.full[j]) }));
  const rangeLabel = PRESETS.find(([v]) => v === preset)[1];

  const add = (id) => { if (!atMax && !selected.includes(id)) setSelected((s) => [...s, id]); };
  const removeProduct = (id) => setSelected((s) => s.filter((x) => x !== id));
  const clear = () => { setSelected([]); setPreset('90d'); setFrom(''); setTo(''); };
  const search = () => { setSearching(true); setTimeout(() => setSearching(false), 550); };

  return (
    <div className="pane">
      <h2 className="pane-title">Price Trends</h2>
      <p className="pane-subtitle">Compare an item across local stores over time — one line per store. Track up to {MAX_PRODUCTS} products.</p>

      <WkCard className="panel filter-card">
        <div className="filter-head"><WI.trend size={15}/> <span>Filter price trends</span></div>

        <div className="filter-grid">
          <div className="span-2"><ProductSearch onAdd={add} disabled={atMax} exclude={selected}/></div>
          <FilterSelect label="Date range" icon={<WI.calendar size={15}/>} value={preset} onChange={(e) => setPreset(e.target.value)}>
            {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FilterSelect>
        </div>

        {preset === 'custom' && (
          <div className="filter-grid filter-dates">
            <div className="filter-field">
              <label className="filter-label">From</label>
              <div className="filter-wrap"><span className="lead-icon"><WI.calendar size={15}/></span>
                <input type="date" className="filter-select" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}/></div>
            </div>
            <div className="filter-field">
              <label className="filter-label">To</label>
              <div className="filter-wrap"><span className="lead-icon"><WI.calendar size={15}/></span>
                <input type="date" className="filter-select" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}/></div>
            </div>
          </div>
        )}

        <div className="filter-sep"/>

        <div className="filter-field">
          <label className="filter-label">Selected products ({selected.length}/{MAX_PRODUCTS})</label>
          <div className="trend-picker">
            {selected.length === 0 && <span className="trend-empty-hint">Search above to add up to {MAX_PRODUCTS} products.</span>}
            {selected.map((id) => {
              const pr = TREND_PRODUCTS.find((p) => p.id === id);
              return (
                <span className="trend-chip" key={id}>
                  {pr.short} <span className="trend-stores">{pr.stores.length} stores</span>
                  <button className="trend-x" aria-label={`Remove ${pr.name}`} onClick={() => removeProduct(id)}>✕</button>
                </span>
              );
            })}
          </div>
        </div>

        <div className="filter-foot">
          <span className={`filter-hint ${rangeInvalid ? 'invalid' : ''}`}>
            <WI.clock size={13}/>
            {rangeInvalid ? 'Range can’t exceed 3 months.' : `${lines.length} lines · max range 3 months`}
          </span>
          <div className="filter-actions">
            <button className="btn btn--text" style={{ padding: '8px 14px' }} onClick={clear}><WI.trash size={14}/> Clear filters</button>
            <WkBtn variant="primary" disabled={rangeInvalid} style={{ padding: '9px 20px', fontSize: 13 }} onClick={search}
                   iconLeft={searching ? null : <WI.search size={15}/>}>
              {searching ? 'Searching…' : 'Search'}
            </WkBtn>
          </div>
        </div>
      </WkCard>

      <WkCard className="panel">
        <div className="panel-header" style={{ marginBottom: 8 }}>
          <span className="panel-title">Price per unit</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rangeInvalid ? 'Last 3 months' : rangeLabel}</span>
        </div>
        {series.length === 0
          ? <div className="table-empty"><WI.trend size={26}/><span>Add a product above to start comparing prices across stores.</span></div>
          : (
            <>
              <LineChart series={series} months={labels}/>
              <div className="trend-legend">
                {series.map((s) => {
                  const d = ((s.data[s.data.length - 1] - s.data[0]) / s.data[0]) * 100;
                  return (
                    <div className="legend-item" key={s.id}>
                      <span className="dot" style={{ background: s.color }}/>
                      <div className="legend-meta">
                        <span className="legend-name">{s.product} · <strong>{s.merchant}</strong></span>
                        <span className="legend-now">€{s.data[s.data.length - 1].toFixed(2)}
                          <span className="legend-delta" style={{ color: d > 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
      </WkCard>
    </div>
  );
}

/* ---- Invoice detail drawer ---- */
const ITEM_CATALOG = {
  'Groceries': ['Whole Milk 1L', 'Free-Range Eggs', 'Sourdough Loaf', 'Bananas 1kg', 'Gouda 400g', 'Tomatoes 500g', 'Chicken Breast', 'Orange Juice 1L'],
  'Bar & Restaurants': ['Main course', 'Side dish', 'House wine', 'Espresso', 'Dessert', 'Cover & service'],
  'Transport': ['Fuel — 95 unleaded', 'Parking', 'Transit ticket', 'Car wash'],
  'Drugstore': ['Shampoo', 'Toothpaste', 'Vitamins', 'Hand soap', 'Plasters'],
  'Others': ['Household goods', 'Stationery', 'Batteries', 'Gift card'],
};
function buildLineItems(inv) {
  const pool = ITEM_CATALOG[inv.category] || ITEM_CATALOG.Others;
  const n = 3 + (inv.id % 3);
  const weights = []; let wsum = 0;
  for (let i = 0; i < n; i++) { const w = 1 + ((inv.id * 3 + i * 7) % 5); weights.push(w); wsum += w; }
  let remaining = Math.round(inv.total * 100);
  const items = [];
  for (let i = 0; i < n; i++) {
    let cents = (i === n - 1) ? remaining : Math.round(inv.total * 100 * weights[i] / wsum);
    cents = Math.max(1, Math.min(cents, remaining - (n - 1 - i)));
    remaining -= cents;
    const qty = ((inv.id + i) % 3 === 0) ? 2 : 1;
    items.push({ name: pool[(inv.id + i) % pool.length], qty, lineTotal: cents / 100 });
  }
  if (remaining !== 0 && items.length) items[items.length - 1].lineTotal += remaining / 100;
  return items.map((it) => ({ ...it, unit: it.lineTotal / it.qty }));
}

function InvoiceDrawer({ invoice, onClose, onRequestDelete, onShare }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [feedback, setFeedback] = React.useState(null); // 'up' | 'down'
  const [pop, setPop] = React.useState(null);
  const giveFeedback = (v) => { setFeedback(v); setPop(v); setTimeout(() => setPop(null), 420); };

  const items = buildLineItems(invoice);
  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const vat = Math.round(subtotal * 0.09 * 100) / 100; // illustrative 9% included

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="invoice-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-merchant">
            <WkMerchant merchant={invoice.merchant} size={40}/>
            <div>
              <div className="drawer-title">{invoice.merchant}</div>
            </div>
          </div>
          <button className="drawer-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-details">
            <div className="dd-row"><span className="dd-label"><WI.box size={14}/> Category</span><span className="dd-val">{invoice.category}</span></div>
            <div className="dd-row"><span className="dd-label"><WI.calendar size={14}/> Date</span><span className="dd-val">{fmtDate(invoice.dateISO)}</span></div>
            <div className="dd-row"><span className="dd-label"><WI.shield size={14}/> Status</span><WkBadge tone={invoice.status[0]}>{invoice.status[1]}</WkBadge></div>
            <div className="dd-row"><span className="dd-label"><WI.tag size={14}/> Tags</span><div className="tag-row">{invoice.tags.map((t) => <WkTag key={t}>{t}</WkTag>)}</div></div>
          </div>

          <div className="drawer-receipt">
            <div className="receipt-head">
              <span>Item</span><span>Qty</span><span>Amount</span>
            </div>
            {items.map((it, i) => (
              <div className="receipt-row" key={i}>
                <span className="ri-name">{it.name}</span>
                <span className="ri-qty">×{it.qty}</span>
                <span className="ri-amt">{eur(it.lineTotal)}</span>
              </div>
            ))}
            <div className="receipt-totals">
              <div><span>Subtotal</span><span>{eur(subtotal - vat)}</span></div>
              <div><span>VAT (9%)</span><span>{eur(vat)}</span></div>
              <div className="receipt-grand"><span>Total</span><span>{eur(invoice.total)}</span></div>
            </div>
          </div>

          <div className="drawer-note">
            <WI.shieldCheck size={14}/> Parsed automatically · location metadata removed.
          </div>

          <div className="drawer-feedback">
            <div className="fb-copy">
              <span className="fb-q">{feedback ? 'Thanks — your feedback trains the scanner.' : 'Did we capture this receipt correctly?'}</span>
              {!feedback && <span className="fb-hint">A quick rating helps us improve AI accuracy for everyone.</span>}
            </div>
            <div className="fb-btns">
              <button className={`fb-btn up ${feedback === 'up' ? 'on' : ''} ${pop === 'up' ? 'pop' : ''}`} aria-label="Accurate" onClick={() => giveFeedback('up')}><WI.thumbsUp size={17}/></button>
              <button className={`fb-btn down ${feedback === 'down' ? 'on' : ''} ${pop === 'down' ? 'pop' : ''}`} aria-label="Inaccurate" onClick={() => giveFeedback('down')}><WI.thumbsDown size={17}/></button>
            </div>
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => onShare && onShare(invoice)}><WI.share size={15}/> Share</button>
          <button className="btn btn--outline drawer-del" onClick={() => onRequestDelete(invoice)}><WI.trash size={15}/> Delete</button>
        </div>
      </aside>
    </div>
  );
}

/* ---- Confirm dialog + toast ---- */
function ConfirmDialog({ title, message, confirmLabel, invoice, onConfirm, onCancel }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="dialog-close" aria-label="Close" onClick={onCancel}>✕</button>
        <div className="confirm-top">
          <div className="confirm-icon"><WI.alertTri size={20}/></div>
          <div className="confirm-head">
            <h3 className="confirm-title">{title}</h3>
            <p className="confirm-msg">{message}</p>
          </div>
        </div>
        {invoice && (
          <div className="confirm-preview">
            <WkMerchant merchant={invoice.merchant} size={36}/>
            <div className="cp-meta">
              <span className="cp-name">{invoice.merchant}</span>
              <span className="cp-sub">{fmtDate(invoice.dateISO)} · {invoice.category}</span>
            </div>
            <span className="cp-amt">{eur(invoice.total)}</span>
          </div>
        )}
        <div className="confirm-actions">
          <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
          <button className="btn confirm-danger" onClick={onConfirm}><WI.trash size={15}/> {confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ShareDialog({ invoice, onClose, onCopy }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const link = `https://wobbl.io/r/${String(invoice.id).slice(-6)}`;
  const waText = encodeURIComponent(`Here's our ${invoice.merchant} receipt (${eur(invoice.total)}) on Wobblio: ${link}`);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-card share-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="dialog-close" aria-label="Close" onClick={onClose}>✕</button>
        <div className="confirm-top">
          <div className="share-icon"><WI.share size={19}/></div>
          <div className="confirm-head">
            <h3 className="confirm-title">Share this receipt</h3>
            <p className="confirm-msg">Send the {invoice.merchant} receipt ({eur(invoice.total)}) to your household. Anyone with the link gets a read-only view — share it straight to WhatsApp or copy it below.</p>
          </div>
        </div>
        <div className="share-link">
          <input className="share-input" readOnly value={link} onFocus={(e) => e.target.select()}/>
          <button className="btn btn--outline share-copy" onClick={() => onCopy(link)}><WI.copy size={15}/> Copy</button>
        </div>
        <a className="btn whatsapp-btn" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">
          <WI.whatsapp size={18}/> Share on WhatsApp
        </a>
      </div>
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const processing = toast.tone === 'processing';
  const Icon = processing ? WI.reload : toast.tone === 'danger' ? WI.trash : WI.check2;
  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      <span className={`toast-icon ${processing ? 'spin' : ''}`}><Icon size={17}/></span>
      <span className="toast-msg">{toast.msg}</span>
      {!processing && <button className="toast-close" aria-label="Dismiss" onClick={onClose}>✕</button>}
    </div>
  );
}

/* ---- Shell ---- */
function Workspace({ theme, onToggleTheme, onSignOut }) {
  const [active, setActive] = React.useState(0);
  const [invoices, setInvoices] = React.useState(INVOICE_DB);
  const [refreshing, setRefreshing] = React.useState(false);
  const [openInvoice, setOpenInvoice] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [shareTarget, setShareTarget] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const toastTimer = React.useRef(null);

  // Simulate asynchronous load of workspace data on mount.
  React.useEffect(() => {
    setLoading(true);
    const id = setTimeout(() => { setInvoices(INVOICE_DB); setLoading(false); }, 1100);
    return () => clearTimeout(id);
  }, []);

  const showToast = (msg, tone = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, tone });
    const ms = tone === 'processing' ? 1600 : 6000;
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => { setInvoices(INVOICE_DB); setRefreshing(false); }, 900);
  };
  const removeInvoice = (id) => setInvoices((list) => list.filter((x) => x.id !== id));
  const shareInvoice = (inv) => setShareTarget(inv);
  const copyLink = (link) => {
    try { navigator.clipboard && navigator.clipboard.writeText(link); } catch (e) {}
    showToast('Link copied — paste it anywhere to share.', 'success');
  };

  const doDelete = () => {
    const inv = confirmDelete;
    removeInvoice(inv.id);
    if (openInvoice && openInvoice.id === inv.id) setOpenInvoice(null);
    setConfirmDelete(null);
    showToast(`${inv.merchant} invoice deleted.`, 'danger');
  };

  const scanReceipt = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,application/pdf';
    input.onchange = () => {
      if (!input.files || !input.files.length) return;
      showToast('Processing your receipt — this can take a few seconds…', 'processing');
      setTimeout(() => {
        const next = {
          id: Date.now(), merchant: 'Albert Heijn', category: 'Groceries',
          dateISO: TODAY.toISOString().slice(0, 10), status: ['primary', 'Auto Parsed'],
          tags: ['weekly'], total: Math.round((10 + Math.random() * 40) * 100) / 100,
        };
        setInvoices((list) => [next, ...list]);
        showToast('Receipt scanned — added to your invoices.', 'success');
      }, 1700);
    };
    input.click();
  };

  return (
    <div className="workspace">
      <div className="app-shell" data-surface="calm">
        <aside className="app-rail">
          <div className="rail-logo"><WkLogo size={30}/></div>
          <nav className="rail-menu">
            {RAIL.map(([icon, label], i) => {
              const Ico = WI[icon];
              return (
                <button key={label} data-tip={label} className={`rail-btn has-tip ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
                  <Ico size={20}/>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="app-body">
          <header className="app-topbar">
            <div className="topbar-title">{RAIL[active][1]}</div>
            <div className="topbar-right">
              <div className="usage-chip" title="Invoices processed this week">
                <span className="usage-icon"><WI.receiptText size={16}/></span>
                <div className="usage-meta">
                  <div className="usage-top">
                    <span className="usage-label">Invoices this week</span>
                    <span className="usage-count"><strong>{INVOICES_THIS_WEEK}</strong> / {WEEKLY_LIMIT}</span>
                  </div>
                  <div className="usage-bar"><div className="usage-fill" style={{ width: `${Math.min(100, (INVOICES_THIS_WEEK / WEEKLY_LIMIT) * 100)}%` }}/></div>
                </div>
              </div>
              <div className="user-chip">
                <WkAvatar initials="AR" title="Antonio R."/>
                <div className="user-meta"><span className="user-plan"><WI.crown/> Premium</span></div>
              </div>
              <button className="signout-btn has-tip has-tip--bottom" data-tip="Sign out" onClick={onSignOut}><WI.logout/></button>
            </div>
          </header>

          {active === 1
            ? <InvoicesPane invoices={invoices} loading={loading} onRemove={removeInvoice} onOpen={setOpenInvoice} onRequestDelete={setConfirmDelete} onShare={shareInvoice}/>
            : active === 3
              ? <PriceTrendsPane/>
              : <DashboardPane invoices={invoices} loading={loading} onRemove={removeInvoice} onOpen={setOpenInvoice} onRequestDelete={setConfirmDelete} onShare={shareInvoice} onScan={scanReceipt} onViewAll={() => setActive(1)} refreshing={refreshing} onRefresh={refresh}/>}
          <Toast toast={toast} onClose={() => { clearTimeout(toastTimer.current); setToast(null); }}/>
        </div>
      </div>
      {openInvoice && <InvoiceDrawer invoice={openInvoice} onClose={() => setOpenInvoice(null)} onRequestDelete={setConfirmDelete} onShare={shareInvoice}/>}
      {shareTarget && <ShareDialog invoice={shareTarget} onClose={() => setShareTarget(null)} onCopy={copyLink}/>}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this invoice?"
          message={`The receipt from ${confirmDelete.merchant} (${eur(confirmDelete.total)}) will be permanently removed. This can’t be undone.`}
          confirmLabel="Delete invoice"
          invoice={confirmDelete}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}/>
      )}
    </div>
  );
}

window.WobblioWorkspace = Workspace;
