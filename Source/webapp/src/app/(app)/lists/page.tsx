'use client'

import { useState } from 'react'
import { Plus, Minus, Trash2, Search, Award, Lightbulb, ShoppingBag } from 'lucide-react'
import { useSandbox } from '@/components/providers/sandbox-provider'
import { Money } from '@/components/ui/money'

const VOCABULARY = [
  "Organic Whole Milk 1L",
  "Organic Avocados",
  "Fairtrade Bananas",
  "Jasmine Rice 5kg",
  "Eggs 12-pack",
  "Sourdough Bread 800g",
  "Bulk Coffee Beans 1kg",
  "Premium Soy Sauce 500ml",
  "Red Sangria 1L"
]

const PRICING_MATRIX: Record<string, Record<string, number>> = {
  'Albert Heijn XL': {
    'Organic Whole Milk 1L': 1.25,
    'Organic Avocados': 1.49,
    'Fairtrade Bananas': 1.99,
    'Jasmine Rice 5kg': 13.50,
    'Eggs 12-pack': 3.49,
    'Sourdough Bread 800g': 2.80,
    'Bulk Coffee Beans 1kg': 19.50,
    'Premium Soy Sauce 500ml': 4.50,
    'Red Sangria 1L': 5.50
  },
  'Jumbo Oostpoort': {
    'Organic Whole Milk 1L': 1.19,
    'Organic Avocados': 1.59,
    'Fairtrade Bananas': 1.89,
    'Jasmine Rice 5kg': 12.99,
    'Eggs 12-pack': 3.19,
    'Sourdough Bread 800g': 2.60,
    'Bulk Coffee Beans 1kg': 18.90,
    'Premium Soy Sauce 500ml': 4.20,
    'Red Sangria 1L': 4.99
  },
  'Dirk van den Broek': {
    'Organic Whole Milk 1L': 1.09,
    'Organic Avocados': 1.29,
    'Fairtrade Bananas': 1.79,
    'Jasmine Rice 5kg': 12.50,
    'Eggs 12-pack': 2.99,
    'Sourdough Bread 800g': 2.45,
    'Bulk Coffee Beans 1kg': 17.99,
    'Premium Soy Sauce 500ml': 3.99,
    'Red Sangria 1L': 4.50
  }
}

// Default fallback price if item name doesn't match matrix
const DEFAULT_PRICE = 2.00

export default function ShoppingListsPage() {
  const { listItems, setListItems } = useSandbox()
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    if (query.trim() === '') {
      setSuggestions([])
    } else {
      const filtered = VOCABULARY.filter(item =>
        item.toLowerCase().includes(query.toLowerCase())
      )
      setSuggestions(filtered)
    }
  }

  const addItem = (itemName: string) => {
    const existing = listItems.find(item => item.name.toLowerCase() === itemName.toLowerCase())
    if (existing) {
      setListItems(prev =>
        prev.map(item =>
          item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      )
    } else {
      const newItem = {
        id: String(Date.now()),
        name: itemName,
        quantity: 1,
        checked: false
      }
      setListItems(prev => [...prev, newItem])
    }
    setSearchQuery('')
    setSuggestions([])
  }

  const handleCustomAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      addItem(searchQuery.trim())
    }
  }

  const toggleItemChecked = (id: string) => {
    setListItems(prev =>
      prev.map(item => (item.id === id ? { ...item, checked: !item.checked } : item))
    )
  }

  const updateQuantity = (id: string, delta: number) => {
    setListItems(prev =>
      prev
        .map(item => {
          if (item.id === id) {
            const nextQty = item.quantity + delta
            return { ...item, quantity: nextQty }
          }
          return item
        })
        .filter(item => item.quantity > 0)
    )
  }

  const deleteItem = (id: string) => {
    setListItems(prev => prev.filter(item => item.id !== id))
  }

  // Calculate totals per retailer
  const calculateTotals = () => {
    const totals: Record<string, number> = {}
    Object.keys(PRICING_MATRIX).forEach(store => {
      let storeTotal = 0
      listItems.forEach(item => {
        const itemPrice = PRICING_MATRIX[store][item.name] ?? DEFAULT_PRICE
        storeTotal += itemPrice * item.quantity
      })
      totals[store] = storeTotal
    })
    return totals
  }

  const storeTotals = calculateTotals()
  
  // Sort stores by price ascending
  const sortedStores = Object.entries(storeTotals).sort((a, b) => a[1] - b[1])
  const cheapestStoreName = sortedStores[0]?.[0]
  const cheapestPrice = sortedStores[0]?.[1] ?? 0
  const mostExpensivePrice = sortedStores[sortedStores.length - 1]?.[1] ?? 0
  const savings = mostExpensivePrice - cheapestPrice

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">Shopping List Optimizer</h1>
        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
          Build your shopping list and outsmart inflation by identifying the cheapest retailer.
        </p>
      </div>

      {/* Savings Banner */}
      {savings > 0 && (
        <div className="flex items-center gap-3 rounded-[12px] border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-electric-indigo shadow-premium-glow">
          <Lightbulb size={18} className="shrink-0 text-electric-indigo" />
          <p className="font-semibold">
            💡 Splitting between stores saves your household <Money amount={savings} size="secondary" className="inline" />!
          </p>
        </div>
      )}

      {/* 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* Left Column: Checklist Builder */}
        <div className="glass-card p-6 lg:col-span-7 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[#0f172a] dark:text-[#f1f5f9] flex items-center gap-2">
            <ShoppingBag className="text-aurora-teal" size={18} />
            My Shopping List
          </h2>

          {/* Autocomplete Input Form */}
          <form onSubmit={handleCustomAdd} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" size={16} />
              <input
                type="text"
                placeholder="Search or add products (e.g. Milk, Avocados...)"
                value={searchQuery}
                onChange={handleSearchChange}
                className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-white pl-10 pr-4 text-sm text-[#0f172a] placeholder:text-[#64748b] focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488]/30 dark:border-[#334155] dark:bg-[#0b0f19] dark:text-[#f1f5f9] dark:placeholder:text-[#94a3b8]"
              />
            </div>

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <ul className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-[#e2e8f0] bg-white shadow-lg dark:border-[#334155] dark:bg-[#111827] overflow-hidden">
                {suggestions.map(suggestion => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => addItem(suggestion)}
                      className="w-full px-4 py-2.5 text-left text-sm text-[#0f172a] hover:bg-[#f8fafc] dark:text-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          {/* Checklist Items list */}
          {listItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-[#64748b] dark:text-[#94a3b8]">
              <span className="text-4xl mb-2">🛒</span>
              <p className="text-sm font-medium">Your shopping list is empty</p>
              <p className="text-xs mt-1">Search or type items above to add them.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#e2e8f0] dark:divide-[#334155]" role="list">
              {listItems.map(item => (
                <li key={item.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItemChecked(item.id)}
                      className="h-5 w-5 rounded border-[#e2e8f0] text-aurora-teal focus:ring-aurora-teal dark:border-[#334155]"
                    />
                    <span className={`text-sm font-medium transition-all ${item.checked ? 'line-through text-[#64748b] dark:text-[#94a3b8]' : 'text-[#0f172a] dark:text-[#f1f5f9]'}`}>
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Qty +/- Controls */}
                    <div className="flex items-center border border-[#e2e8f0] dark:border-[#334155] rounded-md overflow-hidden bg-[#f8fafc] dark:bg-[#0b0f19]">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1.5 hover:bg-[#e2e8f0] dark:hover:bg-[#1e293b] text-[#64748b]"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-2 text-xs font-bold text-[#0f172a] dark:text-[#f1f5f9] select-none min-w-[20px] text-center font-mono">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1.5 hover:bg-[#e2e8f0] dark:hover:bg-[#1e293b] text-[#64748b]"
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Delete item button */}
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"
                      aria-label="Delete item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right Column: Store Cost Comparison Card */}
        <div className="glass-card p-6 lg:col-span-5 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[#0f172a] dark:text-[#f1f5f9] flex items-center gap-2">
            <Award className="text-electric-indigo" size={18} />
            Store Pricing Comparison
          </h2>

          <div className="flex flex-col gap-4">
            {sortedStores.map(([store, total]) => {
              const isCheapest = store === cheapestStoreName
              return (
                <div
                  key={store}
                  className={`flex flex-col p-4 rounded-xl border transition-all ${
                    isCheapest
                      ? 'bg-emerald-500/10 border-emerald-500/20 shadow-sm'
                      : 'bg-slate-100/5 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Retailer
                      </span>
                      <h3 className="text-sm font-bold text-[#0f172a] dark:text-[#f1f5f9] mt-0.5">
                        {store}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Total Cost
                      </span>
                      <div className="mt-0.5 font-mono text-base font-bold text-[#0f172a] dark:text-[#f1f5f9]">
                        <Money amount={total} size="secondary" />
                      </div>
                    </div>
                  </div>

                  {isCheapest && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>🏆 Cheapest Basket</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
