import { TODAY } from './invoice-data'

export const MERCHANT_SHORT: Record<string, string> = {
  'Albert Heijn': 'AH',
  'AH To Go': 'AH To Go',
  'Jumbo Oostpoort': 'Jumbo',
  'Dirk van den Broek': 'Dirk',
  Lidl: 'Lidl',
  Tokomania: 'Tokomania',
  'Restaurante Cantinho': 'Cantinho',
}

export interface TrendProduct {
  id: string
  name: string
  short: string
  stores: Array<[string, number]>
}

export const TREND_PRODUCTS: TrendProduct[] = [
  { id: 'milk', name: 'Organic Whole Milk 1L', short: 'Milk', stores: [['Albert Heijn', 1.29], ['Jumbo Oostpoort', 1.19], ['Lidl', 1.05]] },
  { id: 'coffee', name: 'Arabica Coffee 1kg', short: 'Coffee', stores: [['Albert Heijn', 9.49], ['Jumbo Oostpoort', 8.99], ['Dirk van den Broek', 8.45]] },
  { id: 'eggs', name: 'Free-Range Eggs (12)', short: 'Eggs', stores: [['Albert Heijn', 3.59], ['Jumbo Oostpoort', 3.39]] },
  { id: 'bread', name: 'Sourdough Bread 800g', short: 'Bread', stores: [['Jumbo Oostpoort', 2.79], ['Lidl', 2.45]] },
  { id: 'bananas', name: 'Bananas 1kg', short: 'Bananas', stores: [['Albert Heijn', 1.79], ['Lidl', 1.49]] },
  { id: 'chicken', name: 'Chicken Breast 500g', short: 'Chicken', stores: [['Albert Heijn', 4.49], ['Dirk van den Broek', 3.95]] },
  { id: 'oil', name: 'Olive Oil 500ml', short: 'Olive Oil', stores: [['Jumbo Oostpoort', 6.49], ['Lidl', 5.79]] },
  { id: 'cheese', name: 'Gouda Cheese 400g', short: 'Gouda', stores: [['Albert Heijn', 4.15], ['Jumbo Oostpoort', 3.95], ['Dirk van den Broek', 3.79]] },
]

export const SERIES_COLORS = [
  '#6366f1', '#0d9488', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#0ea5e9', '#22c55e', '#ec4899', '#eab308',
]

export const MAX_PRODUCTS = 3

export const TREND_WEEKS: Date[] = (() => {
  const out: Date[] = []
  for (let i = 25; i >= 0; i--) {
    const d = new Date(TODAY)
    d.setDate(d.getDate() - i * 7)
    out.push(d)
  }
  return out
})()

const weeklySeries = (base: number, seed: number): number[] =>
  TREND_WEEKS.map((_, i) => {
    const drift = 1 + (0.01 + (seed % 3) * 0.008) * (i / 25)
    const wave = Math.sin((i + seed) * 0.5) * base * 0.015
    return Math.round((base * drift + wave) * 100) / 100
  })

export const TREND_DATA: Record<string, number[]> = {}
TREND_PRODUCTS.forEach((pr, p) =>
  pr.stores.forEach(([m, price], s) => {
    TREND_DATA[`${pr.id}|${m}`] = weeklySeries(price, p * 3 + s)
  })
)
