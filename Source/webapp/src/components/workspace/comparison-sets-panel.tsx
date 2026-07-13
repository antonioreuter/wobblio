'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Crown, Link2 } from 'lucide-react'
import { Badge, Card } from '@/components/ds'
import { ProductSearch, type TrendProduct } from './product-search'
import {
  addComparisonMember,
  createComparisonSet,
  deleteComparisonSet,
  fetchComparisonSets,
  removeComparisonMember,
  setMemberSizeEquivalent,
  type ComparisonSet,
} from './comparison-sets-data'

// 09/04 comparison-set management. A set says "these products (each at its own merchant) are
// interchangeable for me". A member is rankable (crown-eligible) only when the user confirmed
// "same size/pack" (size_equivalent) or sizes are known-equal; otherwise it's watch-only.
export function ComparisonSetsPanel({ countryCode, regionCode }: { countryCode: string; regionCode: string }) {
  const [sets, setSets] = useState<ComparisonSet[]>([])
  const [addingTo, setAddingTo] = useState<string | null>(null)

  const reload = () => { void fetchComparisonSets().then(setSets) }
  useEffect(reload, [])

  const onCreate = async () => {
    await createComparisonSet(null)
    reload()
  }

  // "compare with…": add the product, then ask the single "same size/pack?" question.
  const onAddProduct = async (setId: string, product: TrendProduct) => {
    const sameSize = window.confirm('Same size/pack as the other items?\n\nOK = yes (can be crowned as best price)\nCancel = not sure (watch-only until you confirm)')
    await addComparisonMember(setId, product.id, sameSize)
    setAddingTo(null)
    reload()
  }

  return (
    <Card className="panel">
      <div className="panel-header" style={{ marginBottom: 8 }}>
        <span className="panel-title">Comparison sets</span>
        <button type="button" className="btn btn--text" onClick={onCreate} data-testid="comparison-set-create">
          <Plus size={14} /> New set
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
        Link the same item across stores to compare and unlock best-price suggestions. Prices are always
        the price you paid — sizes are shown for context, never turned into a per-unit figure.
      </p>

      {sets.length === 0 && (
        <div className="table-empty" data-testid="comparison-sets-empty">
          <Link2 size={22} />
          <span>No comparison sets yet — create one, then add the same item from different stores.</span>
        </div>
      )}

      {sets.map((set) => (
        <div key={set.id} className="filter-card" style={{ marginBottom: 10 }} data-testid="comparison-set">
          <div className="panel-header" style={{ marginBottom: 6 }}>
            <strong>{set.name ?? 'Untitled set'}</strong>
            <button type="button" className="btn btn--text" onClick={async () => { await deleteComparisonSet(set.id); reload() }} aria-label="Delete set">
              <Trash2 size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {set.members.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-testid="comparison-member">
                <span style={{ flex: 1 }}>
                  {m.displayName} · <strong>{m.merchantName ?? 'Unknown store'}</strong>
                  <span className="legend-unit">{m.size.sizeText ?? 'size not stated'}</span>
                </span>
                {m.sizeEquivalent ? (
                  <Badge tone="success"><Crown size={11} /> comparable</Badge>
                ) : (
                  <Badge tone="warning">watch-only</Badge>
                )}
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={async () => { await setMemberSizeEquivalent(set.id, m.id, !m.sizeEquivalent); reload() }}
                  data-testid="member-toggle-size"
                >
                  {m.sizeEquivalent ? 'mark different' : 'same size/pack'}
                </button>
                <button type="button" className="btn btn--text" onClick={async () => { await removeComparisonMember(set.id, m.id); reload() }} aria-label="Remove member">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          {addingTo === set.id ? (
            <div style={{ marginTop: 8 }}>
              <ProductSearch
                onAdd={(p) => onAddProduct(set.id, p)}
                disabled={set.members.length >= 5}
                exclude={set.members.map((m) => m.productId)}
                mode="market"
                countryCode={countryCode}
                regionCode={regionCode}
              />
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--text"
              style={{ marginTop: 6 }}
              onClick={() => setAddingTo(set.id)}
              disabled={set.members.length >= 5}
              data-testid="comparison-add-member"
            >
              <Plus size={13} /> compare with…{set.members.length >= 5 ? ' (max 5)' : ''}
            </button>
          )}
        </div>
      ))}
    </Card>
  )
}
