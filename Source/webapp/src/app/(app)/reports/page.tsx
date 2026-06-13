'use client'

import { useState, useRef } from 'react'
import { Search, Calendar, Check } from 'lucide-react'
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

const STORES = ['Albert Heijn', 'Jumbo', 'Dirk', 'Lidl']
const STORE_COLORS: Record<string, string> = {
  'Albert Heijn': '#00a1e2',
  'Jumbo': '#f59e0b',
  'Dirk': '#ef4444',
  'Lidl': '#8b5cf6'
}

function getProductBasePrice(productName: string) {
  let hash = 0
  for (let i = 0; i < productName.length; i++) {
    hash = productName.charCodeAt(i) + ((hash << 5) - hash)
  }
  hash = Math.abs(hash)
  return 1.8 + (hash % 100) / 10
}

function getPriceOnDay(store: string, basePrice: number, dayOffset: number) {
  const storeMod = store === 'Albert Heijn' ? 1.12 : store === 'Jumbo' ? 1.04 : store === 'Dirk' ? 0.94 : 0.84
  const storeFreq = store === 'Albert Heijn' ? 18 : store === 'Jumbo' ? 24 : store === 'Dirk' ? 14 : 30
  const fluctuation = Math.sin(dayOffset / storeFreq) * (basePrice * 0.07) + Math.cos(dayOffset / 40) * (basePrice * 0.03)
  return parseFloat((basePrice * storeMod + fluctuation).toFixed(2))
}

export default function ReportsPage() {
  const [product, setProduct] = useState('Organic Whole Milk 1L')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [activeStores, setActiveStores] = useState<Record<string, boolean>>({
    'Albert Heijn': true,
    'Jumbo': true,
    'Dirk': true,
    'Lidl': true
  })
  const [period, setPeriod] = useState<30 | 90 | 180 | 365>(90)

  // Hover state for SVG chart
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hoverState, setHoverState] = useState<{
    show: boolean
    x: number
    dayIndex: number
    dateStr: string
    prices: { store: string; price: number }[]
  } | null>(null)

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

  const selectProduct = (pName: string) => {
    setProduct(pName)
    setSearchQuery('')
    setSuggestions([])
  }

  const toggleStore = (store: string) => {
    setActiveStores(prev => ({
      ...prev,
      [store]: !prev[store]
    }))
  }

  const basePrice = getProductBasePrice(product)
  const today = new Date()

  // Generate data points
  const points: { dayIndex: number; date: Date; dateStr: string; prices: Record<string, number> }[] = []
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(today.getDate() - i)
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const storePrices: Record<string, number> = {}
    STORES.forEach(store => {
      storePrices[store] = getPriceOnDay(store, basePrice, i)
    })
    points.push({
      dayIndex: i,
      date: d,
      dateStr,
      prices: storePrices
    })
  }

  // Find min/max price in the visible dataset to scale Y
  const visiblePrices = points.flatMap(pt =>
    Object.entries(pt.prices)
      .filter(([store]) => activeStores[store])
      .map(([, price]) => price)
  )
  const minPrice = visiblePrices.length > 0 ? Math.min(...visiblePrices) * 0.95 : 0
  const maxPrice = visiblePrices.length > 0 ? Math.max(...visiblePrices) * 1.05 : 10

  // SVG dimensions
  const svgWidth = 800
  const svgHeight = 400
  const paddingLeft = 50
  const paddingRight = 30
  const paddingTop = 30
  const paddingBottom = 45

  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = svgHeight - paddingTop - paddingBottom

  // Mapping functions
  const getX = (index: number) => {
    return paddingLeft + (index / (points.length - 1)) * chartWidth
  }
  const getY = (price: number) => {
    return paddingTop + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight
  }

  // Hover detection handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const clientX = e.clientX - rect.left
    const percentage = clientX / rect.width
    const rawX = percentage * svgWidth

    // Bound checking inside chart area
    if (rawX >= paddingLeft && rawX <= svgWidth - paddingRight) {
      // Find closest day index
      const relativeX = rawX - paddingLeft
      const fraction = relativeX / chartWidth
      const rawIndex = fraction * (points.length - 1)
      const index = Math.max(0, Math.min(points.length - 1, Math.round(rawIndex)))
      
      const point = points[index]
      if (point) {
        const sortedPrices = STORES.filter(store => activeStores[store])
          .map(store => ({
            store,
            price: point.prices[store]
          }))
          .sort((a, b) => a.price - b.price)

        setHoverState({
          show: true,
          x: getX(index),
          dayIndex: index,
          dateStr: point.date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
          prices: sortedPrices
        })
      }
    } else {
      setHoverState(null)
    }
  }

  const handleMouseLeave = () => {
    setHoverState(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">Price Trends Engine</h1>
        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
          Historical pricing intelligence tracking inflation patterns across major retailers.
        </p>
      </div>

      {/* Control Selector Pane */}
      <div className="glass-card p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Product Search Selector */}
        <div className="relative flex-1 max-w-sm">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Selected Product
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" size={15} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery || product}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchQuery === '') setSuggestions(VOCABULARY)
              }}
              className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-3 text-sm text-[#0f172a] focus:border-[#0d9488] focus:outline-none dark:border-[#334155] dark:bg-[#0b0f19] dark:text-[#f1f5f9]"
            />
          </div>

          {/* Suggestions list */}
          {suggestions.length > 0 && (
            <ul className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-[#e2e8f0] bg-white shadow-lg dark:border-[#334155] dark:bg-[#111827] overflow-hidden">
              {suggestions.map(pName => (
                <li key={pName}>
                  <button
                    type="button"
                    onClick={() => selectProduct(pName)}
                    className="w-full px-4 py-2.5 text-left text-sm text-[#0f172a] hover:bg-[#f8fafc] dark:text-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors"
                  >
                    {pName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Retailer Filter Checks */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Retailers
          </span>
          <div className="flex flex-wrap gap-3">
            {STORES.map(store => (
              <button
                key={store}
                onClick={() => toggleStore(store)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeStores[store]
                    ? 'bg-slate-100 dark:bg-slate-800 text-[#0f172a] dark:text-[#f1f5f9] border-slate-300 dark:border-slate-700'
                    : 'bg-transparent text-slate-400 border-dashed border-slate-200 dark:border-slate-800'
                }`}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: activeStores[store] ? STORE_COLORS[store] : '#94a3b8' }}
                />
                {store}
                {activeStores[store] && <Check size={10} />}
              </button>
            ))}
          </div>
        </div>

        {/* Time Periods */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Timeframe
          </span>
          <div className="flex rounded-lg border border-[#e2e8f0] dark:border-[#334155] overflow-hidden">
            {([30, 90, 180, 365] as const).map(days => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                  period === days
                    ? 'bg-electric-indigo text-white'
                    : 'bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {days === 365 ? '1y' : `${days}d`}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* SVG Line Chart Renderer */}
      <div className="glass-card p-6 relative flex flex-col items-center">
        <div className="w-full aspect-[4/3] md:aspect-[2/1] relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full select-none cursor-crosshair overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = paddingTop + ratio * chartHeight
              const price = maxPrice - ratio * (maxPrice - minPrice)
              return (
                <g key={index} className="opacity-40">
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="var(--color-glass-border)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-[#64748b] dark:fill-[#94a3b8] text-[10px] font-mono"
                  >
                    €{price.toFixed(2)}
                  </text>
                </g>
              )
            })}

            {/* X Axis Labels */}
            {points.map((pt, idx) => {
              const labelInterval = Math.ceil(points.length / 6)
              if (idx % labelInterval !== 0 && idx !== points.length - 1) return null
              return (
                <text
                  key={idx}
                  x={getX(idx)}
                  y={svgHeight - paddingBottom + 18}
                  textAnchor="middle"
                  className="fill-[#64748b] dark:fill-[#94a3b8] text-[9px] sm:text-[10px] font-medium"
                >
                  {pt.dateStr}
                </text>
              )
            })}

            {/* Line Charts */}
            {STORES.map(store => {
              if (!activeStores[store]) return null
              
              // Build points string for SVG polyline
              const linePoints = points
                .map((pt, idx) => `${getX(idx)},${getY(pt.prices[store])}`)
                .join(' ')

              return (
                <g key={store}>
                  <polyline
                    fill="none"
                    stroke={STORE_COLORS[store]}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={linePoints}
                    className="transition-all duration-300"
                  />
                </g>
              )
            })}

            {/* Hover Snapping Guide Line & Circles */}
            {hoverState && hoverState.show && (
              <>
                <line
                  x1={hoverState.x}
                  y1={paddingTop}
                  x2={hoverState.x}
                  y2={svgHeight - paddingBottom}
                  stroke="var(--color-electric-indigo)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                {STORES.map(store => {
                  if (!activeStores[store]) return null
                  const storePrice = points[hoverState.dayIndex].prices[store]
                  return (
                    <circle
                      key={store}
                      cx={hoverState.x}
                      cy={getY(storePrice)}
                      r={5}
                      fill={STORE_COLORS[store]}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  )
                })}
              </>
            )}
          </svg>

          {/* Detailed Floating Tooltip */}
          {hoverState && hoverState.show && (
            <div
              className="absolute z-10 p-4 rounded-lg bg-[var(--color-obsidian-glass)] border border-[var(--color-glass-border)] backdrop-blur-[20px] shadow-lg flex flex-col gap-2 text-[11px] sm:text-xs pointer-events-none"
              style={{
                left: `${Math.min(80, (hoverState.x / svgWidth) * 100)}%`,
                top: '10%'
              }}
            >
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold border-b border-[var(--color-glass-border)] pb-1.5 mb-1">
                <Calendar size={12} />
                <span>{hoverState.dateStr}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {hoverState.prices.map(({ store, price }, index) => {
                  const isCheapest = index === 0
                  return (
                    <li key={store} className="flex items-center justify-between gap-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: STORE_COLORS[store] }}
                        />
                        <span className="text-[#f1f5f9]">{store}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Money amount={price} size="secondary" className="font-mono text-star-white font-bold" />
                        {isCheapest && <span className="text-[10px]" title="Cheapest Store">🏆</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
