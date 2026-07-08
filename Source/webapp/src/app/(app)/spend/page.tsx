'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { BarChart3, Calendar, Clock, Crown, Globe, Lock, Package, PieChart, Store, Table2 } from 'lucide-react'
import { Card, Button } from '@/components/ds'
import { FilterSelect, RegionPicker } from '@/components/workspace'
import {
  useSpendBreakdown,
  type SpendFilters,
  type SpendLevel,
  type SpendNode,
  type SpendPreset,
  type SpendSelection,
  type SpendView,
} from '@/components/workspace/spend-breakdown/use-spend-breakdown'
import { SpendDonut } from '@/components/workspace/spend-breakdown/spend-donut'
import { SpendBars } from '@/components/workspace/spend-breakdown/spend-bars'
import { SpendItems } from '@/components/workspace/spend-breakdown/spend-items'
import { SpendBreakdownTable } from '@/components/workspace/spend-breakdown/spend-breakdown-table'
import { SpendBreadcrumb, type SpendCrumb } from '@/components/workspace/spend-breakdown/spend-breadcrumb'

const PRESETS: [SpendPreset, string][] = [
  ['TODAY', 'Today'],
  ['THIS_WEEK', 'This week'],
  ['THIS_MONTH', 'This month'],
  ['LAST_90D', 'Last 3 months'],
  ['CUSTOM', 'Custom'],
]
const MAX_RANGE_DAYS = 90

// The drill path with the display names captured as the user descends (breadcrumb + echoes).
interface Selection {
  categoryId: string | null
  categoryName: string | null
  merchantId: string | null
  merchantName: string | null
  itemCategoryId: string | null
  itemCategoryName: string | null
}

const EMPTY: Selection = {
  categoryId: null, categoryName: null,
  merchantId: null, merchantName: null,
  itemCategoryId: null, itemCategoryName: null,
}

function levelOf(sel: Selection, view: SpendView): SpendLevel {
  if (!sel.categoryId) return 'categories'
  if (view === 'product') return sel.itemCategoryId ? 'items' : 'item-categories'
  if (!sel.merchantId) return 'merchants'
  if (!sel.itemCategoryId) return 'item-categories'
  return 'items'
}

export default function SpendPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  const isPremium = !!role && role !== 'STANDARD'

  const [preset, setPreset] = useState<SpendPreset>('LAST_90D')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [allRegions, setAllRegions] = useState(false)
  const [sel, setSel] = useState<Selection>(EMPTY)
  const [spendView, setSpendView] = useState<SpendView>('merchant')
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [showUpsell, setShowUpsell] = useState(false)

  // Switching the drill shape resets to the top — the paths don't share intermediate levels.
  const switchSpendView = (next: SpendView) => {
    if (next === spendView) return
    setSpendView(next)
    setSel(EMPTY)
    setShowUpsell(false)
  }

  // Default the region to the caller's profile (§ decision 3); the toggle/picker changes it.
  useEffect(() => {
    fetch('/api/me/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { country?: string; regionCode?: string | null } | null) => {
        if (!p) return
        if (p.country) setCountry(p.country)
        if (p.regionCode) setRegion(p.regionCode)
        // No home region to scope by → default to "All regions" so the toggle honestly reflects
        // the (unscoped) data instead of showing "My region" over all-region results.
        else setAllRegions(true)
      })
      .catch(() => undefined)
  }, [])

  const rangeDays =
    from && to ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) : 0
  const rangeInvalid = preset === 'CUSTOM' && from !== '' && to !== '' && (rangeDays < 0 || rangeDays + 1 > MAX_RANGE_DAYS)
  const customIncomplete = preset === 'CUSTOM' && (from === '' || to === '')
  const enabled = !rangeInvalid && !customIncomplete

  const level = levelOf(sel, spendView)
  const activeRegion = allRegions ? '' : region
  const selection: SpendSelection = {
    categoryId: sel.categoryId,
    merchantId: sel.merchantId,
    itemCategoryId: sel.itemCategoryId,
  }
  const filters: SpendFilters = { preset, from, to, country, region: activeRegion, view: spendView }
  const { report, loading, forbidden, error } = useSpendBreakdown(selection, filters, enabled)

  const crumbs = useMemo<SpendCrumb[]>(() => {
    const list: SpendCrumb[] = [{ label: 'All spend', depth: 0 }]
    if (sel.categoryId) list.push({ label: sel.categoryName ?? 'Category', depth: 1 })
    if (sel.merchantId) list.push({ label: sel.merchantName ?? 'Merchant', depth: 2 })
    if (sel.itemCategoryId) list.push({ label: sel.itemCategoryName ?? 'Items', depth: 3 })
    return list
  }, [sel])

  const drillTo = (depth: number) => {
    if (depth === 0) return setSel(EMPTY)
    if (depth === 1) return setSel((s) => ({ ...s, merchantId: null, merchantName: null, itemCategoryId: null, itemCategoryName: null }))
    if (depth === 2) return setSel((s) => ({ ...s, itemCategoryId: null, itemCategoryName: null }))
  }

  const onDrill = (node: SpendNode) => {
    if (level === 'categories') setSel({ ...EMPTY, categoryId: node.id, categoryName: node.name })
    else if (level === 'merchants') setSel((s) => ({ ...s, merchantId: node.id, merchantName: node.name, itemCategoryId: null, itemCategoryName: null }))
    else if (level === 'item-categories') setSel((s) => ({ ...s, itemCategoryId: node.id, itemCategoryName: node.name }))
  }

  // STANDARD tapping the last free level (merchant in store view, item-category in product view),
  // which would open the premium item level.
  const onLocked = () => setShowUpsell(true)

  const clearFilters = () => {
    setPreset('LAST_90D'); setFrom(''); setTo(''); setAllRegions(false); setSel(EMPTY)
  }

  const currentLevel = report?.level ?? level

  return (
    <div className="pane">
      <div className="pane-head-row">
        <p className="pane-subtitle">
          See where your money goes — drill from category
          {spendView === 'merchant' ? ' to merchant' : ' to product category'}
          {isPremium ? ' down to the individual items.' : '. Upgrade to Premium to drill into items.'}
        </p>
        <div className="spend-head-toggles">
          <div className="spend-region-toggle" role="group" aria-label="Breakdown shape">
            <button
              type="button"
              className={`trend-mode-btn ${spendView === 'merchant' ? 'is-active' : ''}`}
              aria-pressed={spendView === 'merchant'}
              onClick={() => switchSpendView('merchant')}
              data-testid="spend-view-merchant"
            >
              <Store size={12} /> By store
            </button>
            <button
              type="button"
              className={`trend-mode-btn ${spendView === 'product' ? 'is-active' : ''}`}
              aria-pressed={spendView === 'product'}
              onClick={() => switchSpendView('product')}
              data-testid="spend-view-product"
            >
              <Package size={12} /> By product
            </button>
          </div>
          <div className="spend-region-toggle" role="group" aria-label="Region scope">
            <button
              type="button"
              className={`trend-mode-btn ${!allRegions ? 'is-active' : ''}`}
              aria-pressed={!allRegions}
              onClick={() => setAllRegions(false)}
              data-testid="spend-region-mine"
            >
              My region
            </button>
            <button
              type="button"
              className={`trend-mode-btn ${allRegions ? 'is-active' : ''}`}
              aria-pressed={allRegions}
              onClick={() => setAllRegions(true)}
              data-testid="spend-region-all"
            >
              <Globe size={12} /> All regions
            </button>
          </div>
        </div>
      </div>

      {showUpsell && !isPremium && (
        <Card className="panel budget-upsell" data-testid="spend-upsell">
          <div className="budget-upsell-icon"><Crown size={22} /></div>
          <h3 className="budget-upsell-title">See the actual items with Premium</h3>
          <p className="budget-upsell-body">
            You can break spend down two levels deep on any plan. Premium unlocks the individual
            products you bought — grouped across trips, with every purchase behind them.
          </p>
          <Link href="/settings"><Button variant="primary" style={{ padding: '8px 16px' }}>Upgrade to Premium</Button></Link>
        </Card>
      )}

      <Card className="panel filter-card">
        <div className="filter-grid">
          <FilterSelect
            label="Date range"
            icon={<Calendar size={15} />}
            value={preset}
            onChange={(e) => setPreset(e.target.value as SpendPreset)}
          >
            {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FilterSelect>
          {!allRegions && (
            <RegionPicker
              countryCode={country}
              regionCode={region}
              onChange={(c, r) => { setCountry(c); setRegion(r) }}
            />
          )}
        </div>

        {preset === 'CUSTOM' && (
          <div className="filter-grid filter-dates">
            <div className="filter-field">
              <label className="filter-label">From</label>
              <input type="date" className="filter-select" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="filter-field">
              <label className="filter-label">To</label>
              <input type="date" className="filter-select" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="filter-foot">
          <span className={`filter-hint ${rangeInvalid ? 'invalid' : ''}`}>
            <Clock size={13} />
            {rangeInvalid ? `Range can’t exceed ${MAX_RANGE_DAYS} days.` : `Max range ${MAX_RANGE_DAYS} days`}
          </span>
          <button type="button" className="btn btn--text" onClick={clearFilters}>Reset</button>
        </div>
      </Card>

      <Card className="panel">
        <div className="panel-header" style={{ marginBottom: 8 }}>
          <SpendBreadcrumb crumbs={crumbs} onNavigate={drillTo} />
          <div className="trend-mode-toggle" role="group" aria-label="Chart or table view">
            <button
              type="button"
              className={`trend-mode-btn ${view === 'chart' ? 'is-active' : ''}`}
              aria-pressed={view === 'chart'}
              onClick={() => setView('chart')}
              data-testid="spend-view-chart"
            >
              {currentLevel === 'categories' ? <PieChart size={12} /> : <BarChart3 size={12} />} Chart
            </button>
            <button
              type="button"
              className={`trend-mode-btn ${view === 'table' ? 'is-active' : ''}`}
              aria-pressed={view === 'table'}
              onClick={() => setView('table')}
              data-testid="spend-view-table"
            >
              <Table2 size={12} /> Table
            </button>
          </div>
        </div>

        <SpendBody
          loading={loading}
          error={error}
          forbidden={forbidden}
          report={report}
          view={view}
          spendView={spendView}
          level={currentLevel}
          isPremium={isPremium}
          onDrill={onDrill}
          onLocked={onLocked}
        />
      </Card>
    </div>
  )
}

function SpendBody({
  loading, error, forbidden, report, view, spendView, level, isPremium, onDrill, onLocked,
}: {
  loading: boolean
  error: boolean
  forbidden: boolean
  report: ReturnType<typeof useSpendBreakdown>['report']
  view: 'chart' | 'table'
  spendView: SpendView
  level: SpendLevel
  isPremium: boolean
  onDrill: (node: SpendNode) => void
  onLocked: () => void
}) {
  if (forbidden) {
    return (
      <div className="table-empty" data-testid="spend-forbidden">
        <Lock size={26} />
        <span>Drilling into items is a Premium feature — upgrade to explore this level.</span>
      </div>
    )
  }
  if (error) {
    return <div className="table-empty"><span>Couldn’t load this breakdown. Try again.</span></div>
  }
  if (loading && !report) {
    return <div className="table-empty"><span>Loading spend…</span></div>
  }
  if (!report) return <div className="table-empty"><span>No spend to show.</span></div>

  const { nodes, currency, total } = report

  if (view === 'table') {
    return <SpendBreakdownTable nodes={nodes} level={level} currency={currency} />
  }

  if (level === 'items') {
    return <SpendItems nodes={nodes} currency={currency} showMerchant={spendView === 'product'} />
  }

  // The last free level is the premium boundary: STANDARD sees the list but each row is locked.
  // That's the merchant level in store view and the item-category level in product view. Rows are
  // inert while a fetch is in flight so a click on the still-visible previous level's bars can't be
  // mis-interpreted at the new (already-advanced) selection level.
  const lockedLevel: SpendLevel = spendView === 'product' ? 'item-categories' : 'merchants'
  const interactive = !loading
  const locked = interactive && level === lockedLevel && !isPremium
  const drillable = interactive && !locked
  return (
    <>
      {level === 'categories' && <SpendDonut nodes={nodes} total={total} currency={currency} />}
      <SpendBars
        nodes={nodes}
        level={level}
        currency={currency}
        drillable={drillable}
        locked={locked}
        onDrill={onDrill}
        onLocked={onLocked}
      />
    </>
  )
}
