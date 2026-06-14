'use client'

import Link from 'next/link'
import { AlertCircle, AlertTriangle, ArrowRight, RotateCw } from 'lucide-react'
import { AnimatedNumber, Card, MetricCard, Money, ProgressBar } from '@/components/ds'
import {
  BUDGETS,
  budgetColor,
  InvoiceTable,
  SpendOverTimeChart,
  useWorkspace,
} from '@/components/workspace'

const SCANS_USED = 9
const SCANS_LIMIT = 15

// Pairs budget meaning with an icon + label so it is never conveyed by color alone.
function budgetStatus(pct: number): { icon: typeof AlertTriangle; label: string } | null {
  if (pct > 100) return { icon: AlertTriangle, label: 'over' }
  if (pct >= 85) return { icon: AlertCircle, label: 'near limit' }
  return null
}

export default function DashboardPage() {
  const {
    invoices,
    loading,
    refreshing,
    refresh,
    setOpenInvoice,
    setConfirmDelete,
    setShareTarget,
  } = useWorkspace()

  const over = BUDGETS.filter((b) => b.pct > 100).length
  const near = BUDGETS.filter((b) => b.pct >= 85 && b.pct <= 100).length
  const onTrack = BUDGETS.filter((b) => b.pct < 85).length
  const budgetTone = over > 0 ? 'danger' : near > 0 ? 'warning' : 'success'
  const budgetValue = over > 0 ? `${over} over` : near > 0 ? `${near} near limit` : 'On track'
  const scansLeft = Math.max(0, SCANS_LIMIT - SCANS_USED)

  return (
    <div className="pane">
      <h2 className="pane-title">Your Everyday Savings</h2>
      <p className="pane-subtitle">Overview of your household expenses and price trends.</p>

      <div className="metrics-row">
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div className="glass" style={{ padding: 'var(--space-5)' }} key={i}>
                <span className="sk sk-line" style={{ width: 90, height: 11 }} />
                <span
                  className="sk sk-line"
                  style={{ width: 120, height: 26, margin: '12px 0 8px' }}
                />
                <span className="sk sk-line" style={{ width: 140, height: 10 }} />
              </div>
            ))
          : (
            <>
              <MetricCard
                label="Spent This Month"
                value={<Money amount={642.3} animate />}
                delta="June, month to date"
                tone="neutral"
              />
              <MetricCard
                label="vs Last Month"
                value={<AnimatedNumber value={11.8} decimals={1} prefix="↓ " suffix="%" />}
                delta="−€86.12 from €728.42"
                tone="success"
              />
              <MetricCard
                label="Budget Health"
                value={budgetValue}
                delta={`${onTrack} on track · ${near} near limit · ${over} over`}
                tone={budgetTone}
              />
              <MetricCard
                label="Scans Remaining"
                value={<AnimatedNumber value={scansLeft} suffix=" left" />}
                delta={`${SCANS_USED} of ${SCANS_LIMIT} used this week`}
                tone={scansLeft <= 3 ? 'warning' : 'neutral'}
              />
              <MetricCard
                className="metric-ultrawide"
                label="Top Merchant"
                value="Albert Heijn"
                delta="€248.60 this month"
                tone="neutral"
              />
            </>
          )}
      </div>

      <div className="dash-row">
        <SpendOverTimeChart />

        <Card className="panel budget-tones">
          <div className="panel-header" style={{ marginBottom: 4 }}>
            <span className="panel-title">Category Budgets</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 18 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{BUDGETS.length} budgets</strong>{' '}
            tracked ·{' '}
            <strong style={{ color: over ? 'var(--danger)' : 'var(--success)' }}>
              {over} over budget
            </strong>
          </p>
          {BUDGETS.map((b) => {
            const tone = budgetColor(b.pct)
            const status = budgetStatus(b.pct)
            const StatusIcon = status?.icon
            return (
              <div className="budget-item" key={b.name}>
                <div className="budget-meta">
                  <span className="name">{b.name}</span>
                  <span className="pct" style={{ color: `var(--${tone})` }}>
                    {StatusIcon && <StatusIcon size={13} aria-hidden="true" />}
                    <AnimatedNumber value={b.pct} suffix="%" />
                    {status ? ` ${status.label}` : ''}
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(b.pct, 100)}
                  tone={tone}
                  animate
                  ariaLabel={`${b.name} ${b.pct}%${status ? `, ${status.label}` : ''}`}
                />
              </div>
            )
          })}
          <Link href="/budgets" className="panel-footer-link" data-testid="dashboard-view-budgets">
            View all budgets <ArrowRight size={14} />
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
