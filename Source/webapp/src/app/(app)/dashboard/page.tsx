'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShoppingCart, 
  Coffee, 
  Flame, 
  UtensilsCrossed, 
  Upload, 
  X, 
  ThumbsUp,
  ThumbsDown,
  BarChart3
} from 'lucide-react';

interface InvoiceItem {
  name: string;
  price: string;
}

interface InvoiceRow {
  id: string;
  merchant: string;
  date: string;
  status: 'Processed' | 'Needs Review' | 'Auto Parsed';
  tags: string[];
  total: string;
  items: InvoiceItem[];
  image: string;
}

export default function DashboardPage() {
  // Mock Invoices state
  const [invoices, setInvoices] = useState<InvoiceRow[]>([
    {
      id: '1',
      merchant: 'Jumbo Oostpoort',
      date: '12 Jun 2026',
      status: 'Processed',
      tags: ['dinner', 'weekly'],
      total: '€28.74',
      image: '/invoices/jumbo_2.jpeg',
      items: [
        { name: 'Tomatoes (Organic)', price: '€2.49' },
        { name: 'Greek Yoghurt', price: '€1.89' },
        { name: 'Fresh Basil', price: '€1.29' },
        { name: 'Weekly Grocery Items', price: '€23.07' }
      ]
    },
    {
      id: '2',
      merchant: 'AH To Go',
      date: '11 Jun 2026',
      status: 'Needs Review',
      tags: ['commute'],
      total: '€12.15',
      image: '/invoices/ah_to_go_1.jpeg',
      items: [
        { name: 'Double Espresso', price: '€3.50' },
        { name: 'Butter Croissant', price: '€1.85' },
        { name: 'Organic Orange Juice', price: '€4.30' },
        { name: 'Tuna Wrap', price: '€2.50' }
      ]
    },
    {
      id: '3',
      merchant: 'Tokomania',
      date: '09 Jun 2026',
      status: 'Auto Parsed',
      tags: ['pantry'],
      total: '€34.20',
      image: '/invoices/tk_1.jpeg',
      items: [
        { name: 'Soy Sauce 500ml', price: '€4.50' },
        { name: 'Jasmine Rice 5kg', price: '€18.20' },
        { name: 'Chili Paste', price: '€3.80' },
        { name: 'Sesame Oil', price: '€7.70' }
      ]
    }
  ]);

  // Metrics state
  const [mtdSpend, setMtdSpend] = useState('€1,284.50');
  const [mtdDelta, setMtdDelta] = useState('€98.50');
  const [budgetHealth, setBudgetHealth] = useState('68%');
  const [scansRemaining, setScansRemaining] = useState(3);

  // Interactive slide drawer for receipt inspection
  const [activeDrawerInvoice, setActiveDrawerInvoice] = useState<InvoiceRow | null>(null);

  // Ingestion Simulation Overlay States
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatingStep, setSimulatingStep] = useState<1 | 2 | 3>(1);
  const [simulatingText, setSimulatingText] = useState('Compressing receipt image...');

  const triggerDashboardUpload = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulatingStep(1);
    setSimulatingText('Compressing receipt image...');

    // Step 1: Compress (1.2s)
    setTimeout(() => {
      setSimulatingStep(2);
      setSimulatingText('Preparing secure upload & checking hashes...');
    }, 1200);

    // Step 2: Upload & Hash (2.4s)
    setTimeout(() => {
      setSimulatingStep(3);
      setSimulatingText('AI is reading receipt items and tip fields...');
    }, 2400);

    // Step 3: Parse & Extract (3.6s)
    setTimeout(() => {
      setIsSimulating(false);

      // Create new Restaurante Cantinho row
      const newInvoice: InvoiceRow = {
        id: (invoices.length + 1).toString(),
        merchant: 'Restaurante Cantinho',
        date: '12 Jun 2026',
        status: 'Needs Review',
        tags: ['dinner', 'split'],
        total: '€42.50',
        image: '/invoices/ah_1.jpeg',
        items: [
          { name: 'Cod Fish a Bras', price: '€18.50' },
          { name: 'Vinho Verde Bottle', price: '€14.00' },
          { name: 'Olives & Couvert', price: '€4.00' },
          { name: 'Espresso (2)', price: '€3.00' },
          { name: 'Service Tip', price: '€3.00' }
        ]
      };

      // Add to start of list
      setInvoices(prev => [newInvoice, ...prev]);

      // Update metrics dynamically
      setMtdSpend('€1,327.00');
      setMtdDelta('€141.00');
      setBudgetHealth('71%');
      setScansRemaining(prev => Math.max(0, prev - 1));
    }, 3600);
  };

  // State for line items feedback (thumbs up/down)
  const [itemFeedback, setItemFeedback] = useState<Record<string, 'up' | 'down' | undefined>>({});

  return (
    <div className="workspace-content-pane active" id="paneDashboard" style={{ padding: 0 }}>
      {/* Header Row */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="workspace-pane-title">Your Everyday Savings</h2>
          <p className="workspace-pane-subtitle" style={{ marginBottom: 0 }}>
            Overview of your household expenses and price trends.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center rounded-lg bg-aurora-teal px-4 text-xs font-semibold text-white hover:bg-[#0f766e] min-h-[44px]"
          onClick={triggerDashboardUpload}
        >
          <Upload size={14} className="mr-1.5" />
          Upload Invoice
        </button>
      </div>

      {/* Metrics Panel Row */}
      <div className="metrics-grid-row">
        {/* Month-to-date spend */}
        <div className="glass metric-panel-card flex flex-col justify-between">
          <div>
            <div className="metric-panel-title">Month-to-date spend</div>
            <div className="metric-panel-value">{mtdSpend}</div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[#fee2e2] text-[#dc2626] font-bold">
              +8.3%
            </span>
            <span className="text-xs text-[#64748b] dark:text-[#94a3b8] font-semibold">vs May</span>
          </div>
        </div>

        {/* Delta vs last month */}
        <div className="glass metric-panel-card flex flex-col justify-between">
          <div>
            <div className="metric-panel-title">Δ vs last month</div>
            <div className="metric-panel-value">{mtdDelta}</div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[#fee2e2] text-[#dc2626] font-bold">
              +8.3%
            </span>
            <span className="text-xs text-[#64748b] dark:text-[#94a3b8] font-semibold">more</span>
          </div>
        </div>

        {/* Budget health */}
        <div className="glass metric-panel-card flex flex-col justify-between">
          <div>
            <div className="metric-panel-title">Budget health</div>
            <div className="metric-panel-value">{budgetHealth}</div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[#dcfce7] text-[#16a34a] font-bold">
              -5.2%
            </span>
            <span className="text-xs text-[#64748b] dark:text-[#94a3b8] font-semibold">vs last month</span>
          </div>
        </div>

        {/* Scans remaining */}
        <div className="glass metric-panel-card flex flex-col justify-between">
          <div>
            <div className="metric-panel-title">Scans remaining</div>
            <div className="metric-panel-value">{scansRemaining}</div>
          </div>
          <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2 font-semibold">
            of 10 monthly scans
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="dashboard-details-row">
        {/* Left Column - Category Chart & Table */}
        <div className="flex flex-col gap-5">
          {/* Monthly Category Expenses Bar Chart */}
          <div className="glass p-5">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
              <BarChart3 size={16} className="text-aurora-teal" />
              Category Expenses This Month
            </h3>
            <div className="category-expenses-chart">
              {/* Groceries */}
              <div className="category-expense-row">
                <div className="category-expense-meta text-[var(--text-primary)]">
                  <span>Groceries</span>
                  <span>€340.00 (68%)</span>
                </div>
                <div className="category-expense-bar-container">
                  <div className="category-expense-bar-fill bg-[var(--color-aurora-teal)]" style={{ width: '68%' }} />
                </div>
              </div>

              {/* Dining */}
              <div className="category-expense-row">
                <div className="category-expense-meta text-[var(--text-primary)]">
                  <span>Dining</span>
                  <span>€261.00 (87%)</span>
                </div>
                <div className="category-expense-bar-container">
                  <div className="category-expense-bar-fill bg-[var(--color-warm-amber)]" style={{ width: '87%' }} />
                </div>
              </div>

              {/* Home & Garden */}
              <div className="category-expense-row">
                <div className="category-expense-meta text-[var(--text-primary)]">
                  <span>Home & Garden</span>
                  <span>€124.00 (41%)</span>
                </div>
                <div className="category-expense-bar-container">
                  <div className="category-expense-bar-fill bg-[var(--brand)]" style={{ width: '41%' }} />
                </div>
              </div>

              {/* Transport */}
              <div className="category-expense-row">
                <div className="category-expense-meta text-[var(--text-primary)]">
                  <span>Transport</span>
                  <span>€78.00 (52%)</span>
                </div>
                <div className="category-expense-bar-container">
                  <div className="category-expense-bar-fill bg-teal-500" style={{ width: '52%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Invoices Table Card */}
          <div className="glass table-panel-card">
            <div className="panel-card-header flex justify-between items-center p-4 border-b border-[var(--glass-border)]">
              <span className="panel-card-title text-base font-bold text-[var(--text-primary)]">Recent Invoices</span>
              <button className="btn btn--outline" style={{ padding: '6px 14px', fontSize: '12.5px' }} id="dashboardBulkBtn">
                Bulk Categorize
              </button>
            </div>
            <div className="table-wrapper overflow-x-auto">
              <table className="app-table" id="dashboardTable">
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Tags</th>
                    <th className="numeric-col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr 
                      key={inv.id}
                      onClick={() => setActiveDrawerInvoice(inv)}
                      className="cursor-pointer hover:bg-slate-100/5 transition-colors"
                      data-invoice-id={inv.id}
                    >
                      <td>
                        <div className="row-merchant-cell flex items-center gap-2.5">
                          <div className={`merchant-icon-badge h-8 w-8 flex items-center justify-center rounded-[8px] font-bold ${
                            inv.merchant.toLowerCase().startsWith('jumbo') ? 'bg-[#f59e0b] text-[#0f172a]' :
                            inv.merchant.toLowerCase().startsWith('ah') ? 'bg-[#00a1e2] text-white' :
                            inv.merchant.toLowerCase().startsWith('tokomania') ? 'bg-[#10b981] text-white' :
                            inv.merchant.toLowerCase().startsWith('restaurante') ? 'bg-[#be123c] text-white' : 'bg-slate-500 text-white'
                          }`}>
                            {inv.merchant.toLowerCase().startsWith('jumbo') && <ShoppingCart className="h-[55%] w-[55%] stroke-[2]" />}
                            {inv.merchant.toLowerCase().startsWith('ah') && <Coffee className="h-[55%] w-[55%] stroke-[2]" />}
                            {inv.merchant.toLowerCase().startsWith('tokomania') && <Flame className="h-[55%] w-[55%] stroke-[2]" />}
                            {inv.merchant.toLowerCase().startsWith('restaurante') && <UtensilsCrossed className="h-[55%] w-[55%] stroke-[2]" />}
                          </div>
                          <span className="font-semibold text-sm text-[var(--text-primary)]">{inv.merchant}</span>
                        </div>
                      </td>
                      <td className="text-sm text-[var(--text-secondary)]">{inv.date}</td>
                      <td>
                        <span className={`badge ${
                          inv.status === 'Processed' ? 'badge--success' : 
                          inv.status === 'Needs Review' ? 'badge--warning' : 'badge--primary'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        <div className="tag-badge-row flex gap-1.5 flex-wrap">
                          {inv.tags.map((tag) => (
                            <span key={tag} className="table-tag text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-[var(--glass-border)]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="numeric-col text-sm font-bold text-[var(--text-primary)] tabular">{inv.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar widgets */}
        <div className="flex flex-col gap-5">
          {/* Key Product Trend sparkline */}
          <div className="glass trends-preview-card p-4">
            <div className="trends-preview-header flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Key Product Trend</h3>
              <Link href="/reports" className="text-link-btn text-xs text-[var(--brand)] hover:underline">
                Analyze
              </Link>
            </div>
            <div className="trends-preview-body flex justify-between items-center">
              <div className="trends-preview-info">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">Organic Whole Milk 1L</h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Recent average: €3.55</p>
              </div>
              <div className="quick-sparkline-container flex-shrink-0">
                <svg width="100" height="30">
                  <path d="M 0,25 L 20,20 L 40,20 L 60,5 L 80,10" fill="none" stroke="var(--color-electric-indigo)" strokeWidth="2"></path>
                  <circle cx="80" cy="10" r="3" fill="var(--color-electric-indigo)"></circle>
                </svg>
              </div>
            </div>
          </div>

          {/* Category progress budgets */}
          <div className="glass chart-panel-card p-5">
            <div className="panel-card-header mb-3 flex items-center justify-between">
              <span className="panel-card-title text-sm font-bold text-[var(--text-primary)]">Category Budgets</span>
            </div>
            <div className="category-progress-list flex flex-col gap-3.5">
              <div className="budget-progress-item flex flex-col gap-1.5">
                <div className="budget-item-meta flex justify-between text-xs text-[var(--text-secondary)]">
                  <span className="budget-item-name font-semibold">Fresh Food</span>
                  <span className="budget-item-percentage font-mono font-bold">76%</span>
                </div>
                <div className="progress-track h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="progress-fill-bar h-full bg-[var(--color-aurora-teal)] rounded-full" style={{ width: '76%' }}></div>
                </div>
              </div>
              
              <div className="budget-progress-item flex flex-col gap-1.5">
                <div className="budget-item-meta flex justify-between text-xs text-[var(--text-secondary)]">
                  <span className="budget-item-name font-semibold">Dining Out</span>
                  <span className="budget-item-percentage font-mono font-bold">88%</span>
                </div>
                <div className="progress-track h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="progress-fill-bar h-full bg-[var(--color-sunset-coral)] rounded-full" style={{ width: '88%' }}></div>
                </div>
              </div>

              <div className="budget-progress-item flex flex-col gap-1.5">
                <div className="budget-item-meta flex justify-between text-xs text-[var(--text-secondary)]">
                  <span className="budget-item-name font-semibold">Utilities / Fuel</span>
                  <span className="budget-item-percentage font-mono font-bold">51%</span>
                </div>
                <div className="progress-track h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="progress-fill-bar h-full bg-[var(--color-electric-indigo)] rounded-full" style={{ width: '51%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Ingestion Stepper Overlay */}
      {isSimulating && (
        <div className="fullscreen-overlay active" id="fullscreenUploadOverlay">
          <div className="glass loading-panel-box flex flex-col items-center justify-center p-8 max-w-sm w-full text-center">
            <div className="loading-spinner-circle mb-4">
              <div className="spinner-inner"></div>
            </div>
            <h3 className="text-lg font-bold mb-1 text-[var(--text-primary)]">Processing Receipt</h3>
            <p className="loader-step-text text-sm text-[var(--text-secondary)] mb-6" id="fullscreenProgressText">
              {simulatingText}
            </p>
            <div className="stepper-horizontal flex justify-between w-full relative">
              <div className={`stepper-step ${simulatingStep >= 1 ? 'active' : ''}`} id="stepperStep1">
                <span className="step-bullet">1</span>
                <span className="step-text text-xs mt-1">Upload</span>
              </div>
              <div className={`stepper-step ${simulatingStep >= 2 ? 'active' : ''}`} id="stepperStep2">
                <span className="step-bullet">2</span>
                <span className="step-text text-xs mt-1">Validate</span>
              </div>
              <div className={`stepper-step ${simulatingStep >= 3 ? 'active' : ''}`} id="stepperStep3">
                <span className="step-bullet">3</span>
                <span className="step-text text-xs mt-1">Extract</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide Drawer Backdrop */}
      {activeDrawerInvoice && (
        <div 
          className="drawer-backdrop" 
          id="drawerBackdrop" 
          style={{ display: 'block', opacity: 1 }}
          onClick={() => setActiveDrawerInvoice(null)}
        />
      )}

      {/* Slide Drawer panel */}
      {activeDrawerInvoice && (
        <aside className="inspection-drawer active" id="inspectionDrawer">
          <div className="drawer-header flex justify-between items-center p-4 border-b border-[var(--glass-border)]">
            <span className="drawer-title text-base font-bold text-[var(--text-primary)]" id="drawerStoreTitle">
              {activeDrawerInvoice.merchant}
            </span>
            <button 
              className="drawer-close-btn bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer" 
              id="drawerCloseBtn" 
              onClick={() => setActiveDrawerInvoice(null)}
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="drawer-body p-4 flex flex-col gap-5 overflow-y-auto">
            {/* Receipt Photo Thumbnail */}
            <div className="drawer-receipt-preview rounded-xl overflow-hidden border border-[var(--glass-border)] bg-slate-950">
              <img 
                src={activeDrawerInvoice.image} 
                id="drawerImage" 
                alt="Receipt Thumbnail" 
                className="w-full object-contain max-h-56"
              />
            </div>

            {/* Ingest metadata */}
            <div className="drawer-meta-section flex flex-col gap-2 border border-[var(--glass-border)] rounded-xl p-3 bg-slate-900/40">
              <div className="drawer-meta-row flex justify-between text-xs">
                <span className="drawer-meta-label text-[var(--text-muted)]">Purchase Date</span>
                <span className="drawer-meta-value text-[var(--text-primary)] font-semibold" id="drawerMetaDate">
                  {activeDrawerInvoice.date}
                </span>
              </div>
              <div className="drawer-meta-row flex justify-between text-xs">
                <span className="drawer-meta-label text-[var(--text-muted)]">Scan Status</span>
                <span className="drawer-meta-value text-[var(--text-primary)] font-semibold" id="drawerMetaConf">
                  {activeDrawerInvoice.status}
                </span>
              </div>
              <div className="drawer-meta-row flex justify-between text-xs">
                <span className="drawer-meta-label text-[var(--text-muted)]">Uploaded By</span>
                <span className="drawer-meta-value text-[var(--text-primary)] font-semibold">
                  AR - Antonio
                </span>
              </div>
            </div>

            {/* Line items list */}
            <div className="drawer-lines-list flex flex-col gap-2">
              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Extracted Line Items</h4>
              <div className="flex flex-col gap-1.5" id="drawerLinesContainer">
                {activeDrawerInvoice.items.map((item, index) => (
                  <div key={index} className="drawer-line-item flex justify-between items-center p-2.5 bg-slate-900/20 border border-[var(--glass-border)] rounded-lg text-sm">
                    <div className="flex flex-col">
                      <span className="drawer-line-name text-[var(--text-primary)] font-medium">{item.name}</span>
                      <div className="flex gap-2 mt-1">
                        <button 
                          className={`p-0.5 transition-colors ${itemFeedback[item.name] === 'up' ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`}
                          onClick={() => setItemFeedback(prev => ({ ...prev, [item.name]: prev[item.name] === 'up' ? undefined : 'up' }))}
                          title="Correct Extraction"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          className={`p-0.5 transition-colors ${itemFeedback[item.name] === 'down' ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                          onClick={() => setItemFeedback(prev => ({ ...prev, [item.name]: prev[item.name] === 'down' ? undefined : 'down' }))}
                          title="Incorrect Extraction"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="drawer-line-price text-[var(--text-primary)] font-bold font-mono tabular">{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
