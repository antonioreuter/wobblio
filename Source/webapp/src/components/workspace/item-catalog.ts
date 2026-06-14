import type { Invoice } from './invoice-data'

const ITEM_CATALOG: Record<string, string[]> = {
  Groceries: ['Whole Milk 1L', 'Free-Range Eggs', 'Sourdough Loaf', 'Bananas 1kg', 'Gouda 400g', 'Tomatoes 500g', 'Chicken Breast', 'Orange Juice 1L'],
  'Bar & Restaurants': ['Main course', 'Side dish', 'House wine', 'Espresso', 'Dessert', 'Cover & service'],
  Transport: ['Fuel — 95 unleaded', 'Parking', 'Transit ticket', 'Car wash'],
  Drugstore: ['Shampoo', 'Toothpaste', 'Vitamins', 'Hand soap', 'Plasters'],
  Others: ['Household goods', 'Stationery', 'Batteries', 'Gift card'],
}

export interface LineItem {
  name: string
  qty: number
  lineTotal: number
  unit: number
}

export function buildLineItems(inv: Invoice): LineItem[] {
  const pool = ITEM_CATALOG[inv.category] ?? ITEM_CATALOG.Others
  const n = 3 + (inv.id % 3)
  const weights: number[] = []
  let wsum = 0
  for (let i = 0; i < n; i++) {
    const w = 1 + ((inv.id * 3 + i * 7) % 5)
    weights.push(w)
    wsum += w
  }
  let remaining = Math.round(inv.total * 100)
  const items: Array<{ name: string; qty: number; lineTotal: number }> = []
  for (let i = 0; i < n; i++) {
    let cents = i === n - 1 ? remaining : Math.round((inv.total * 100 * weights[i]) / wsum)
    cents = Math.max(1, Math.min(cents, remaining - (n - 1 - i)))
    remaining -= cents
    const qty = (inv.id + i) % 3 === 0 ? 2 : 1
    items.push({ name: pool[(inv.id + i) % pool.length], qty, lineTotal: cents / 100 })
  }
  if (remaining !== 0 && items.length) items[items.length - 1].lineTotal += remaining / 100
  return items.map((it) => ({ ...it, unit: it.lineTotal / it.qty }))
}
