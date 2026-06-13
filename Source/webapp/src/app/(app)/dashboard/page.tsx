'use client'

import Link from 'next/link'
import { ArrowRight, RotateCw, Upload } from 'lucide-react'
import { Button, Card, MetricCard, ProgressBar } from '@/components/ds'
import {
  BUDGETS,
  budgetColor,
  InvoiceTable,
  SPEND,
  useWorkspace,
} from '@/components/workspace'

function SpendChart() {
  return (
    <Card className="panel">
      <div className="panel-header" style={{ marginBottom: 4 }}>
        <span className="panel-title">Spending by Category</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>June 2026</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 20 }}>
        How your{' '}
        <strong style={{ color: 'var(--text-primary)' }}>€642.30</strong>{' '}
        broke down across expense types.
      </p>
      <div className="spend-chart">
        {SPEND.map(([label, val, h]) => (
          <div className="spend-col" key={label}>
            <div className="spend-val">€{Math.round(val)}</div>
            <div
              className="spend-bar"
              style={{ height: h }}
              title={`${label}: €${val.toFixed(2)}`}
            />
            <div className="spend-label">{label}</div>
          </div>
        ))}
      </div>
    </Card>
  )
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
    scanReceipt,
  } = useWorkspace()

  const overBudget = BUDGETS.filter((b) => b.pct >= 100).length

  return (
    <div className="pane">
      <h2 className="pane-title">Your Everyday Savings</h2>
      <p className="pane-subtitle">Overview of your household expenses and price trends.</p>

      <div className="metrics-row">
        {loading
          ? [0, 1, 2].map((i) => (
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
                value="€642.30"
                delta="↓ 11.8% vs €728.42 last month"
                tone="success"
              />
              <MetricCard
                label="Needs Check"
                value="3 items"
                delta="1 receipt needs verification"
                tone="warning"
              />
              <MetricCard
                label="Processed This Month"
                value="24"
                delta="receipts scanned in June"
                tone="neutral"
              />
            </>
          )}
      </div>

      <div className="dash-row">
        <div className="stack">
          <SpendChart />

          <Card className="panel" style={{ padding: 0 }}>
            <div className="panel-header" style={{ padding: '20px 24px 0' }}>
              <span className="panel-title">Recent Invoices</span>
              <div className="panel-actions">
                <Button
                  variant="outline"
                  className="refresh-btn"
                  style={{ padding: '6px 14px', fontSize: 12.5 }}
                  onClick={refresh}
                  iconLeft={
                    <span
                      className={`refresh-ico ${refreshing ? 'spin' : ''}`}
                      style={{ display: 'flex' }}
                    >
                      <RotateCw size={14} />
                    </span>
                  }
                  data-testid="dashboard-refresh"
                >
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </Button>
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

        <div className="stack">
          <Card
            className="upload-dropzone"
            style={{ padding: '28px 20px', cursor: 'pointer' }}
            onClick={scanReceipt}
            data-testid="dashboard-upload"
          >
            <div className="upload-icon"><Upload size={26} /></div>
            <h3 style={{ fontSize: 15, marginBottom: 4, color: 'var(--text-primary)' }}>
              Upload New Receipt
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Drag and drop a receipt (PNG, JPG, PDF), or{' '}
              <span style={{ color: 'var(--brand)', textDecoration: 'underline' }}>browse files</span>
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Location metadata removed · compressed client-side.
            </p>
          </Card>

          <Card className="panel budget-tones">
            <div className="panel-header" style={{ marginBottom: 4 }}>
              <span className="panel-title">Category Budgets</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 18 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{BUDGETS.length} budgets</strong>{' '}
              tracked ·{' '}
              <strong style={{ color: overBudget ? 'var(--danger)' : 'var(--success)' }}>
                {overBudget} over budget
              </strong>
            </p>
            {BUDGETS.map((b) => {
              const tone = budgetColor(b.pct)
              return (
                <div className="budget-item" key={b.name}>
                  <div className="budget-meta">
                    <span className="name">{b.name}</span>
                    <span className="pct" style={{ color: `var(--${tone})` }}>{b.pct}%</span>
                  </div>
                  <ProgressBar value={Math.min(b.pct, 100)} tone={tone} />
                </div>
              )
            })}
          </Card>
        </div>
      </div>
    </div>
  )
}
