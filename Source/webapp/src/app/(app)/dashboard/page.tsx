'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowRight, RotateCw } from 'lucide-react'
import { AnimatedNumber, Card, MerchantIcon, MetricCard, Money, ProgressBar } from '@/components/ds'
import {
  budgetPercent,
  InvoiceTable,
  LocationPromptBanner,
  needsLocationConfirmation,
  scopeLabel,
  SpendOverTimeChart,
  useBudgetReference,
  useWorkspace,
} from '@/components/workspace'
import { computeSpendMetrics, computeDailySeriesForMonth } from '@/lib/invoice-metrics'

export default function DashboardPage() {
  const { data: session } = useSession()
  const {
    invoices,
    usage,
    topMerchants,
    budgets,
    loading,
    refreshing,
    refresh,
    setOpenInvoice,
    setConfirmDelete,
    setShareTarget,
  } = useWorkspace()

  const { categoryNames, memberNames } = useBudgetReference(budgets.length > 0, session?.user?.id)

  const metrics = useMemo(() => computeSpendMetrics(invoices, new Date()), [invoices])
  const dailyMetrics = useMemo(() => computeDailySeriesForMonth(invoices, new Date()), [invoices])
  const pendingLocation = useMemo(() => invoices.filter(needsLocationConfirmation), [invoices])

  // Top budgets by utilisation lead the dashboard card; the health metric
  // summarises how many are still under their 85% alert line.
  const topBudgets = useMemo(
    () => [...budgets].sort((a, b) => budgetPercent(b) - budgetPercent(a)).slice(0, 4),
    [budgets],
  )
  const breached = budgets.filter((b) => budgetPercent(b) >= 100).length
  const nearing = budgets.filter((b) => budgetPercent(b) >= 85 && budgetPercent(b) < 100).length
  const onTrack = budgets.length - breached - nearing
  const budgetTone = breached > 0 ? 'danger' : nearing > 0 ? 'warning' : 'success'

  const delta = metrics.deltaPct
  const spendingDown = delta !== null && delta < 0
  const diff = metrics.thisMonth - metrics.lastMonth

  return (
    <div className="pane">
      <h2 className="pane-title">Your Everyday Savings</h2>
      <p className="pane-subtitle">Overview of your household expenses and price trends.</p>

      <LocationPromptBanner
        count={pendingLocation.length}
        onConfirm={() => setOpenInvoice(pendingLocation[0])}
      />

      <div className="metrics-row">
        {loading
          ? [0, 1, 2, 3].map((i) => (
            <div className="glass" style={{ padding: 'var(--space-5)' }} key={i}>
              <span className="sk sk-line" style={{ width: 90, height: 11 }} />
              <span className="sk sk-line" style={{ width: 120, height: 26, margin: '12px 0 8px' }} />
              <span className="sk sk-line" style={{ width: 140, height: 10 }} />
            </div>
          ))
          : (
            <>
              <MetricCard
                label="Spent This Month"
                value={<Money amount={metrics.thisMonth} animate />}
                delta="Month to date"
                tone="neutral"
              />
              <MetricCard
                label="vs Last Month"
                value={
                  delta === null
                    ? '—'
                    : <AnimatedNumber value={Math.abs(delta)} decimals={1} prefix={spendingDown ? '↓ ' : '↑ '} suffix="%" />
                }
                delta={
                  delta === null
                    ? 'No prior-month spend yet'
                    : `${diff < 0 ? '−' : '+'}€${Math.abs(diff).toFixed(2)} from €${metrics.lastMonth.toFixed(2)}`
                }
                tone={delta === null ? 'neutral' : spendingDown ? 'success' : 'warning'}
              />
              <MetricCard
                label="Budget Health"
                value={budgets.length === 0 ? '—' : `${onTrack}/${budgets.length} on track`}
                delta={
                  budgets.length === 0
                    ? 'No budgets set'
                    : breached > 0
                      ? `${breached} over budget`
                      : nearing > 0
                        ? `${nearing} nearing the limit`
                        : 'All within limits'
                }
                tone={budgets.length === 0 ? 'neutral' : budgetTone}
              />
              <MetricCard
                label="Scans Remaining"
                value={
                  !usage
                    ? '—'
                    : usage.unlimited
                      ? '∞ left'
                      : <AnimatedNumber value={usage.remaining ?? 0} suffix=" left" />
                }
                delta={
                  !usage
                    ? 'Loading…'
                    : usage.unlimited
                      ? `${usage.used} used this week`
                      : `${usage.used} of ${usage.cap} used this week`
                }
                tone={usage && !usage.unlimited && (usage.remaining ?? 0) <= 3 ? 'warning' : 'neutral'}
              />
            </>
          )}
      </div>

      <div className="dash-row">
        <SpendOverTimeChart data={metrics.series} dailyData={dailyMetrics} />

        <div className="stack">
          <Card className="panel">
            <div className="panel-header" style={{ marginBottom: 4 }}>
              <span className="panel-title">Top Merchants</span>
            </div>
            {topMerchants.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '12px 0 18px' }}>
                No spending this month yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '16px 0 4px' }}>
                {topMerchants.map((m, idx) => {
                  const max = topMerchants[0].total
                  const pct = max > 0 ? (m.total / max) * 100 : 0
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <MerchantIcon merchant={m.name} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>€{m.total.toFixed(2)}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'var(--glass-border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: 'var(--brand)', transition: 'width .4s ease' }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="panel">
            <div className="panel-header" style={{ marginBottom: 4 }}>
              <span className="panel-title">Category Budgets</span>
            </div>
            {topBudgets.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '12px 0 18px' }}>
                Set budgets to track spending against your goals and get alerted before you overspend.
              </p>
            ) : (
              <div style={{ margin: '14px 0 18px' }}>
                {topBudgets.map((b) => {
                  const pct = budgetPercent(b)
                  const tone = pct >= 100 ? 'danger' : pct >= 85 ? 'warning' : 'success'
                  return (
                    <div className="budget-item" key={b.id}>
                      <div className="budget-meta">
                        <span className="name">{scopeLabel(b, categoryNames, memberNames)}</span>
                        <span className="pct" style={{ color: `var(--${tone})` }}>{pct}%</span>
                      </div>
                      <ProgressBar value={pct} tone={tone} animate />
                    </div>
                  )
                })}
              </div>
            )}
            <Link href="/budgets" className="panel-footer-link" data-testid="dashboard-view-budgets">
              Go to budgets <ArrowRight size={14} />
            </Link>
          </Card>
        </div>
      </div>

      <Card className="panel" style={{ padding: 0, marginTop: 20 }}>
        <div className="panel-header" style={{ padding: '20px 24px 0' }}>
          <span className="panel-title">Recent Invoices</span>
          <div className="panel-actions">
            <button
              type="button"
              className="btn-icon has-tip has-tip--bottom"
              data-tip="Refresh"
              aria-label="Refresh invoices"
              onClick={refresh}
              data-testid="dashboard-refresh"
            >
              <span className={`refresh-ico ${refreshing ? 'spin' : ''}`} style={{ display: 'flex' }}>
                <RotateCw size={15} />
              </span>
            </button>
            <Link
              href="/invoices"
              className="btn btn--primary"
              style={{ padding: '6px 14px', fontSize: 12.5 }}
              data-testid="dashboard-view-all"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <InvoiceTable
          invoices={invoices.slice(0, 4)}
          loading={loading}
          skeletonRows={4}
          onOpen={setOpenInvoice}
          onRequestDelete={setConfirmDelete}
          onShare={setShareTarget}
        />
      </Card>
    </div>
  )
}
