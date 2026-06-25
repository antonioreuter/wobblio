'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ListChecks, Plus } from 'lucide-react'
import { Button, Card } from '@/components/ds'
import { useWorkspace } from './workspace-provider'
import { CreateListDialog } from './create-list-dialog'
import { ConfirmDialog } from './confirm-dialog'
import { AddItemRow } from './add-item-row'
import { ListItemRow } from './list-item-row'
import { ListOptimizerPanel } from './list-optimizer-panel'
import {
  activeListLimit,
  addItem,
  completeList,
  fetchListDetail,
  fetchLists,
  patchItem,
  removeItem,
  type ListDetail,
  type ListSummary,
} from './list-data'

export function ShoppingLists() {
  const { data: session } = useSession()
  const { showToast } = useWorkspace()
  const role = session?.user?.role
  const limit = activeListLimit(role)

  const [lists, setLists] = useState<ListSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ListDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [completing, setCompleting] = useState(false)
  // Tracks the most recently requested list so a slow in-flight detail fetch
  // can't overwrite a newer selection (last-click-wins).
  const requestedListRef = useRef<string | null>(null)

  const loadLists = useCallback(async () => {
    setLoading(true)
    try {
      setLists(await fetchLists())
    } catch {
      showToast('Couldn’t load your lists — please try again.', 'danger')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { void loadLists() }, [loadLists])

  const openList = useCallback(async (id: string) => {
    requestedListRef.current = id
    setSelectedId(id)
    setDetail(null)
    setDetailError(false)
    setDetailLoading(true)
    try {
      const loaded = await fetchListDetail(id)
      if (requestedListRef.current !== id) return // a newer selection won
      setDetail(loaded)
    } catch {
      if (requestedListRef.current !== id) return
      setDetailError(true)
      showToast('Couldn’t open that list — please try again.', 'danger')
    } finally {
      if (requestedListRef.current === id) setDetailLoading(false)
    }
  }, [showToast])

  const bumpCount = (id: string, delta: number) =>
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, itemCount: l.itemCount + delta } : l)))

  const onAddItem = async (freeText: string, productId: string | null) => {
    if (!detail) return
    const id = detail.id
    try {
      await addItem(id, freeText, productId)
    } catch {
      showToast('Couldn’t add that item — please try again.', 'danger')
      return
    }
    // The item is created; a refresh failure must not look like an add failure
    // (which would prompt a duplicate re-add).
    bumpCount(id, 1)
    try {
      const loaded = await fetchListDetail(id)
      if (requestedListRef.current === id) setDetail(loaded)
    } catch {
      showToast('Item added, but the list couldn’t refresh — reopen it to see changes.', 'danger')
    }
  }

  const onToggle = async (itemId: string, checked: boolean) => {
    if (!detail) return
    const prev = detail
    setDetail({ ...detail, items: detail.items.map((it) => (it.id === itemId ? { ...it, checked } : it)) })
    try {
      await patchItem(detail.id, itemId, { checked })
    } catch {
      setDetail(prev)
      showToast('Couldn’t update that item — please try again.', 'danger')
    }
  }

  const onEditItem = async (itemId: string, freeText: string) => {
    if (!detail) return
    const prev = detail
    setDetail({ ...detail, items: detail.items.map((it) => (it.id === itemId ? { ...it, freeText } : it)) })
    try {
      await patchItem(detail.id, itemId, { freeText })
    } catch {
      setDetail(prev)
      showToast('Couldn’t rename that item — please try again.', 'danger')
    }
  }

  const onRemoveItem = async (itemId: string) => {
    if (!detail) return
    const prev = detail
    setDetail({ ...detail, items: detail.items.filter((it) => it.id !== itemId) })
    try {
      await removeItem(detail.id, itemId)
      bumpCount(detail.id, -1)
    } catch {
      setDetail(prev)
      showToast('Couldn’t remove that item — please try again.', 'danger')
    }
  }

  const onComplete = async () => {
    if (!detail) return
    const id = detail.id
    setCompleting(false)
    try {
      await completeList(id)
      setLists((prev) => prev.filter((l) => l.id !== id))
      setSelectedId(null)
      setDetail(null)
      showToast('List completed.', 'success')
    } catch {
      showToast('Couldn’t complete that list — please try again.', 'danger')
    }
  }

  const atLimit = lists.length >= limit

  return (
    <div className="pane">
      <div className="pane-head-row">
        <div>
          <h2 className="pane-title">Shopping Lists</h2>
          <p className="pane-subtitle">
            Plan what to buy, check items off as you shop.{' '}
            <span className="tabular">{lists.length}</span> / {limit} active.
          </p>
        </div>
        <Button
          iconLeft={<Plus size={15} />}
          onClick={() => setCreating(true)}
          disabled={atLimit}
          data-testid="list-create"
        >
          New list
        </Button>
      </div>

      <div className="list-layout">
        <Card className="panel list-master">
          {loading ? (
            <div className="list-cards">
              {[0, 1, 2].map((i) => (
                <span className="sk sk-line" key={i} style={{ width: '100%', height: 44, marginBottom: 8 }} />
              ))}
            </div>
          ) : lists.length === 0 ? (
            <div className="budget-empty" data-testid="list-empty">
              <div className="budget-empty-icon"><ListChecks size={20} /></div>
              <p className="budget-empty-title">No lists yet</p>
              <p className="budget-empty-body">Create your first list to start planning a shop.</p>
            </div>
          ) : (
            <div className="list-cards" data-testid="list-cards">
              {lists.map((l) => (
                <button
                  type="button"
                  key={l.id}
                  className={`list-card ${selectedId === l.id ? 'list-card--active' : ''}`}
                  onClick={() => openList(l.id)}
                  data-testid="list-card"
                >
                  <span className="list-card-name">{l.name}</span>
                  <span className="list-card-count tabular">
                    {l.itemCount} {l.itemCount === 1 ? 'item' : 'items'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="list-detail">
          {!selectedId ? (
            <Card className="panel list-detail-empty" data-testid="list-detail-empty">
              <p className="budget-empty-body">Select a list to view and edit its items.</p>
            </Card>
          ) : (
            <>
              <Card className="panel">
                <div className="panel-header">
                  <span className="panel-title">{detail?.name ?? 'Loading…'}</span>
                  {detail && (
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={() => setCompleting(true)}
                      data-testid="list-complete"
                    >
                      Complete list
                    </button>
                  )}
                </div>

                {detailError ? (
                  <div className="list-items-empty" data-testid="list-detail-error">
                    <p>Couldn’t load this list.</p>
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={() => openList(selectedId)}
                    >
                      Try again
                    </button>
                  </div>
                ) : detailLoading || !detail ? (
                  <div className="list-items">
                    {[0, 1, 2].map((i) => (
                      <span className="sk sk-line" key={i} style={{ width: '100%', height: 32, marginBottom: 8 }} />
                    ))}
                  </div>
                ) : (
                  <>
                    <AddItemRow key={selectedId} onAdd={onAddItem} disabled={false} />
                    {detail.items.length === 0 ? (
                      <p className="list-items-empty">No items yet — add the first one above.</p>
                    ) : (
                      <div className="list-items" data-testid="list-items">
                        {detail.items.map((item) => (
                          <ListItemRow
                            key={item.id}
                            item={item}
                            onToggle={(checked) => onToggle(item.id, checked)}
                            onEdit={(text) => onEditItem(item.id, text)}
                            onRemove={() => onRemoveItem(item.id)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>

              {detail && (
                <ListOptimizerPanel key={selectedId} listId={detail.id} role={role} itemCount={detail.items.length} />
              )}
            </>
          )}
        </div>
      </div>

      {creating && (
        <CreateListDialog
          onClose={() => setCreating(false)}
          onCreated={async (id) => {
            await loadLists()
            void openList(id)
          }}
        />
      )}

      {completing && detail && (
        <ConfirmDialog
          title="Complete this list?"
          message={`“${detail.name}” will be archived and removed from your active lists.`}
          confirmLabel="Complete list"
          onConfirm={onComplete}
          onCancel={() => setCompleting(false)}
        />
      )}
    </div>
  )
}
