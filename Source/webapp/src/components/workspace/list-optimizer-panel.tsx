'use client'

import { useState } from 'react'
import { Crown, Route, Store } from 'lucide-react'
import { Badge, Button, Card, Money } from '@/components/ds'
import { useWorkspace } from './workspace-provider'
import {
  canOptimize,
  optimizeList,
  STALE_OBSERVATION_DAYS,
  type Confidence,
  type OptimizationResult,
  type StoreLine,
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

const daysOld = (iso: string | null): number | null => {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

// §6.5.3 split-route optimizer surface. Premium-gated (mirrors the budgets upsell).
// Renders the store-grouped result with honest per-line confidence and staleness,
// and lists items the optimizer couldn't price.
export function ListOptimizerPanel({ listId, role, itemCount }: ListOptimizerPanelProps) {
  const { showToast } = useWorkspace()
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [running, setRunning] = useState(false)

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

  const run = async () => {
    setRunning(true)
    try {
      setResult(await optimizeList(listId))
    } catch {
      showToast('Couldn’t optimize this list — please try again.', 'danger')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card className="panel" data-testid="optimizer-panel">
      <div className="panel-header">
        <span className="panel-title">Split-route optimizer</span>
        <Button
          iconLeft={<Route size={15} />}
          onClick={run}
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
        <OptimizerResult result={result} />
      )}
    </Card>
  )
}

function OptimizerResult({ result }: { result: OptimizationResult }) {
  return (
    <div className="optimizer-result" data-testid="optimizer-result">
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

      {result.stores.map((store) => (
        <div className="store-block" key={store.merchantId} data-testid="optimizer-store">
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
      ))}

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

function StoreLineRow({ line }: { line: StoreLine }) {
  const conf = CONFIDENCE[line.confidence]
  const age = daysOld(line.lastObservedOn)
  const stale = age !== null && age > STALE_OBSERVATION_DAYS
  return (
    <div className={`store-line ${stale ? 'store-line--stale' : ''}`} data-testid="optimizer-line">
      <span className="store-line-name">{line.displayName}</span>
      <span className="store-line-meta">
        <Badge tone={conf.tone} className="store-line-conf">{conf.label}</Badge>
        {age !== null && (
          <span className="store-line-age">{stale ? `${age}d old` : `${age}d`}</span>
        )}
      </span>
      <span className="store-line-price tabular"><Money amount={line.expectedPrice} /></span>
    </div>
  )
}
