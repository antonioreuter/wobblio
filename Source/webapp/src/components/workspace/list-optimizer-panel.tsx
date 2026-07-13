'use client'

import { useState } from 'react'
import { Crown, Route, Store, X } from 'lucide-react'
import { Avatar, Badge, Button, Card, Money } from '@/components/ds'
import { useWorkspace } from './workspace-provider'
import {
  canOptimize,
  optimizeList,
  STALE_OBSERVATION_DAYS,
  type ComparabilityReason,
  type Confidence,
  type OptimizationResult,
  type OwnHistoryBasketTotal,
  type StoreLine,
  type StoreSubList,
} from './list-data'

interface ListOptimizerPanelProps {
  listId: string
  role: string | undefined
  itemCount: number
}

const CONFIDENCE: Record<Confidence, { label: string; tone: 'success' | 'primary' | 'warning' }> = {
  high: { label: 'High confidence', tone: 'success' },
  medium: { label: 'Some history', tone: 'primary' },
  low: { label: 'Low confidence', tone: 'warning' },
}

// 09/05 per-line hint: only non-rankable states get a chip (comparable is the normal case, and a
// single-store item with no link needs no explanation).
const REASON_CHIP: Partial<Record<ComparabilityReason, { label: string; tone: 'warning' | 'danger' }>> = {
  watch_only: { label: 'watch-only — confirm same size', tone: 'warning' },
  ambiguous: { label: 'varies — may cover different products', tone: 'danger' },
}

const daysOld = (iso: string | null): number | null => {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

const storeInitials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

// §6.5.3 split-route optimizer surface. Premium-gated (mirrors the budgets upsell).
// Renders the store-grouped result with honest per-line confidence and staleness,
// a removable store-chip row (mirrors the bill-split "People" chips), and lists
// items the optimizer couldn't price.
export function ListOptimizerPanel({ listId, role, itemCount }: ListOptimizerPanelProps) {
  const { showToast } = useWorkspace()
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [running, setRunning] = useState(false)
  // Session-local, one-off exclusions (§10c) — reset when the panel remounts
  // (i.e. the shopper reopens the list), never persisted server-side.
  const [excludedMerchantIds, setExcludedMerchantIds] = useState<string[]>([])

  if (!canOptimize(role)) {
    return (
      <Card className="panel budget-upsell" data-testid="optimizer-upsell">
        <div className="budget-upsell-icon"><Crown size={22} /></div>
        <h3 className="budget-upsell-title">Split-route optimizer is a Premium feature</h3>
        <p className="budget-upsell-body">
          Premium splits your list across the cheapest nearby stores and shows the expected
          saving — using crowdsourced regional prices.
        </p>
      </Card>
    )
  }

  const run = async (excluded: string[]) => {
    setRunning(true)
    try {
      setResult(await optimizeList(listId, excluded))
    } catch {
      showToast('Couldn’t optimize this list — please try again.', 'danger')
    } finally {
      setRunning(false)
    }
  }

  const removeStore = (merchantId: string) => {
    const next = [...excludedMerchantIds, merchantId]
    setExcludedMerchantIds(next)
    void run(next)
  }

  return (
    <Card className="panel" data-testid="optimizer-panel">
      <div className="panel-header">
        <span className="panel-title">
          Split-route optimizer
          {result && <Badge tone="primary" className="premium-pill">Premium</Badge>}
        </span>
        <Button
          iconLeft={<Route size={15} />}
          onClick={() => run(excludedMerchantIds)}
          disabled={running || itemCount === 0}
          data-testid="optimizer-run"
        >
          {running ? 'Optimizing…' : result ? 'Re-optimize' : 'Optimize route'}
        </Button>
      </div>

      {!result ? (
        <p className="optimizer-hint">
          {itemCount === 0
            ? 'Add a few items, then optimize to see the cheapest stores for them.'
            : 'Find the cheapest split across nearby stores. Every scan makes it smarter.'}
        </p>
      ) : (
        <OptimizerResult result={result} onRemoveStore={removeStore} />
      )}
    </Card>
  )
}

function OptimizerResult({
  result,
  onRemoveStore,
}: {
  result: OptimizationResult
  onRemoveStore: (merchantId: string) => void
}) {
  const removable = result.stores.length > 1
  const total = result.stores.reduce((sum, s) => sum + s.subtotal, 0)

  return (
    <div className="optimizer-result" data-testid="optimizer-result">
      {result.stores.length > 0 && (
        <div className="store-chip-row" data-testid="optimizer-store-chips">
          {result.stores.map((store) => (
            <div className="store-chip" key={store.merchantId} data-testid="optimizer-store-chip">
              <Avatar initials={storeInitials(store.name)} size={26} />
              <span className="store-chip-name">{store.name}</span>
              {removable && (
                <button
                  type="button"
                  className="store-chip-remove"
                  aria-label={`Remove ${store.name} from this route`}
                  onClick={() => onRemoveStore(store.merchantId)}
                  data-testid="optimizer-store-chip-remove"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {result.optimized ? (
        <p className="optimizer-headline">
          Save <Money amount={result.totalExpectedSaving} className="optimizer-save" /> across{' '}
          <span className="tabular">{result.stores.length}</span>{' '}
          {result.stores.length === 1 ? 'store' : 'stores'}
        </p>
      ) : (
        <p className="optimizer-headline optimizer-headline--flat">
          {result.stores.length === 0
            ? 'Not enough price data yet to suggest a route. Every scan makes it smarter.'
            : `One store is cheapest right now${result.reason ? ` — ${result.reason}.` : '.'}`}
        </p>
      )}
      {result.stores.length > 0 && (
        <p className="optimizer-progress tabular">
          <Money amount={total} /> grouped across {result.stores.length} {result.stores.length === 1 ? 'store' : 'stores'}
        </p>
      )}

      {result.stores.map((store) => (
        <StoreBlock key={store.merchantId} store={store} />
      ))}

      {result.ownHistoryBasket && result.ownHistoryBasket.length > 0 && (
        <OwnHistoryBasket totals={result.ownHistoryBasket} />
      )}

      {result.unresolvedItems.length > 0 && (
        <div className="optimizer-unresolved" data-testid="optimizer-unresolved">
          <p className="optimizer-unresolved-title">Not priced (added to your main store)</p>
          <ul className="optimizer-unresolved-list">
            {result.unresolvedItems.map((name, i) => (
              <li key={`${name}-${i}`}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function StoreBlock({ store }: { store: StoreSubList }) {
  return (
    <div className="store-block" data-testid="optimizer-store">
      <div className="store-head">
        <span className="store-name">
          <Store size={14} /> {store.name}
          {store.isPrimary && <span className="store-primary">primary</span>}
        </span>
        <span className="store-subtotal tabular"><Money amount={store.subtotal} /></span>
      </div>
      <div className="store-lines">
        {store.lines.map((line) => (
          <StoreLineRow key={line.productId} line={line} />
        ))}
      </div>
    </div>
  )
}

function StoreLineRow({ line }: { line: StoreLine }) {
  const conf = CONFIDENCE[line.confidence]
  const age = daysOld(line.lastObservedOn)
  const stale = age !== null && age > STALE_OBSERVATION_DAYS
  const reasonChip = line.reason ? REASON_CHIP[line.reason] : undefined
  return (
    <div className={`store-line ${stale ? 'store-line--stale' : ''}`} data-testid="optimizer-line">
      <span className="store-line-name">
        {line.displayName}
        {line.quantity > 1 && (
          <span className="store-line-qty tabular"> ×{line.quantity} @ <Money amount={line.expectedPrice} /></span>
        )}
      </span>
      <span className="store-line-meta">
        <Badge tone={conf.tone} className="store-line-conf">{conf.label}</Badge>
        {reasonChip && <Badge tone={reasonChip.tone} className="store-line-conf" data-testid="optimizer-line-reason">{reasonChip.label}</Badge>}
        {age !== null && (
          <span className="store-line-age">{stale ? `${age}d old` : `${age}d`}</span>
        )}
      </span>
      <span className="store-line-price tabular"><Money amount={line.lineTotal} /></span>
    </div>
  )
}

// 09/05 zero-usable-links fallback: the tenant's own-history whole-basket total per merchant,
// clearly labeled as own-history-based (never a crowned cross-store claim).
function OwnHistoryBasket({ totals }: { totals: OwnHistoryBasketTotal[] }) {
  return (
    <div className="optimizer-unresolved" data-testid="optimizer-own-history">
      <p className="optimizer-unresolved-title">Your usual basket, from your own history</p>
      <div className="store-lines">
        {totals.map((t) => (
          <div className="store-line" key={t.merchantId}>
            <span className="store-line-name">{t.name}</span>
            <span className="store-line-meta"><Badge tone="primary" className="store-line-conf">{t.itemsPriced} priced</Badge></span>
            <span className="store-line-price tabular"><Money amount={t.total} /></span>
          </div>
        ))}
      </div>
      <p className="optimizer-hint">Link items across stores (in Reports → Comparison sets) to unlock split suggestions.</p>
    </div>
  )
}
