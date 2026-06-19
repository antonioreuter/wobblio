'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, RotateCw } from 'lucide-react'
import { AnimatedNumber, Card, MetricCard, Money } from '@/components/ds'
import { InvoiceTable, SpendOverTimeChart, useWorkspace } from '@/components/workspace'
import { computeSpendMetrics } from '@/lib/invoice-metrics'

export default function DashboardPage() {
  const {
    invoices,
    usage,
    loading,
    refreshing,
    refresh,
    setOpenInvoice,
    setConfirmDelete,
    setShareTarget,
  } = useWorkspace()

  const metrics = useMemo(() => computeSpendMetrics(invoices, new Date()), [invoices])

  const delta = metrics.deltaPct
  const spendingDown = delta !== null && delta < 0
  const diff = metrics.thisMonth - metrics.lastMonth

  return (
    <div className="pane">
      <h2 className="pane-title">Your Everyday Savings</h2>
      <p className="pane-subtitle">Overview of your household expenses and price trends.</p>

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
                value="-"
                delta="Budgets arrive in a later release"
                tone="neutral"
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
              <MetricCard
                className="metric-ultrawide"
                label="Top Merchant"
                value={metrics.topMerchant?.name ?? '—'}
                delta={metrics.topMerchant ? `€${metrics.topMerchant.total.toFixed(2)} this month` : 'No spend this month'}
                tone="neutral"
              />
            </>
          )}
      </div>

      <div className="dash-row">
        <SpendOverTimeChart data={metrics.series} />

        <Card className="panel">
          <div className="panel-header" style={{ marginBottom: 4 }}>
            <span className="panel-title">Category Budgets</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '12px 0 18px' }}>
            Set monthly category budgets to track spending against your goals. Budget tracking lands
            with the Budgets release.
          </p>
          <Link href="/budgets" className="panel-footer-link" data-testid="dashboard-view-budgets">
            Go to budgets <ArrowRight size={14} />
          </Link>
        </Card>
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
