import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  activeListLimit,
  canOptimize,
  PREMIUM_ACTIVE_LISTS,
  STANDARD_ACTIVE_LISTS,
  addItem,
  completeList,
  createList,
  fetchLists,
  optimizeList,
  patchItem,
} from './list-data'

const ok = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as Response
const fail = (status: number): Response =>
  ({ ok: false, status, json: async () => ({}) }) as Response

afterEach(() => {
  vi.restoreAllMocks()
})

describe('activeListLimit', () => {
  it('caps STANDARD (and unknown role) at the lower limit', () => {
    expect(activeListLimit('STANDARD')).toBe(STANDARD_ACTIVE_LISTS)
    expect(activeListLimit(undefined)).toBe(STANDARD_ACTIVE_LISTS)
  })

  it('grants the higher limit to PREMIUM and operator roles', () => {
    expect(activeListLimit('PREMIUM')).toBe(PREMIUM_ACTIVE_LISTS)
    expect(activeListLimit('ADMIN')).toBe(PREMIUM_ACTIVE_LISTS)
  })
})

describe('canOptimize', () => {
  it('is true for any non-STANDARD role', () => {
    expect(canOptimize('PREMIUM')).toBe(true)
    expect(canOptimize('TESTER')).toBe(true)
  })

  it('is false for STANDARD or no role', () => {
    expect(canOptimize('STANDARD')).toBe(false)
    expect(canOptimize(undefined)).toBe(false)
  })
})

describe('fetch helpers', () => {
  it('fetchLists unwraps the lists envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ lists: [{ id: 'l-1', name: 'Groceries', categoryId: 'cat-groceries', itemCount: 2, createdAt: 'x' }] }))
    const lists = await fetchLists()
    expect(lists).toHaveLength(1)
    expect(lists[0].name).toBe('Groceries')
  })

  it('createList returns the new id and posts the name + categoryId', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ id: 'l-9' }))
    const id = await createList('Weekly', 'cat-groceries')
    expect(id).toBe('l-9')
    expect(spy).toHaveBeenCalledWith('/api/lists', expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ name: 'Weekly', categoryId: 'cat-groceries' })
  })

  it('addItem sends freeText + productId + quantity (default 1)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ id: 'i-1' }))
    await addItem('l-1', 'Milk', 'p-3')
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ freeText: 'Milk', productId: 'p-3', quantity: 1 })
  })

  it('optimizeList returns the optimization result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ optimized: true, totalExpectedSaving: 7.4, stores: [], unresolvedItems: [], baseline: null, reason: null }))
    const res = await optimizeList('l-1')
    expect(res.optimized).toBe(true)
    expect(res.totalExpectedSaving).toBe(7.4)
  })

  it('throws the status code on a failed write', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fail(409))
    await expect(createList('x', 'cat-groceries')).rejects.toThrow('409')
  })

  it('patchItem and completeList resolve on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({}))
    await expect(patchItem('l-1', 'i-1', { checked: true })).resolves.toBeUndefined()
    await expect(completeList('l-1')).resolves.toBeUndefined()
  })
})
