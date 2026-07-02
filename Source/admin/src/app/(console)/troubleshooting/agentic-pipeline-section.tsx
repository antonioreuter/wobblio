'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Workflow, RefreshCw, Store, Package, FolderTree, Tag, ChevronRight, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/ui/console-section'
import { StatTile } from './stat-tile'
import type { QueueHealth } from './types'

// Widened to `string`: this is fetched JSON, not authored data, so the frontend must render
// gracefully if the backend ever reports a stage this file doesn't know about yet (see
// KNOWN_STAGE_META fallback below) rather than silently dropping it.
type AgenticStage = string

interface StageFailure {
  invoiceId: string
  message: string
  timestamp: string
}

interface StageHealth {
  stage: AgenticStage
  invocations: number
  failures: number
  avgDurationMs: number
  lastFailure: StageFailure | null
}

interface AgenticPipelineView {
  enabled: boolean
  queueHealth: QueueHealth | null
  stages: StageHealth[]
}

interface StageMeta {
  stage: AgenticStage
  label: string
  icon: typeof Store
}

// Fixed display order + icon for the 4 stages the coordinator runs today. A stage present in
// the API response but absent here (e.g. a future 5th stage) still renders — see
// stageMetaFor() — it just gets a generic icon/label instead of a curated one.
const KNOWN_STAGE_META: StageMeta[] = [
  { stage: 'MERCHANT_RESOLUTION', label: 'Merchant', icon: Store },
  { stage: 'PRODUCT_NORMALIZATION', label: 'Product', icon: Package },
  { stage: 'INVOICE_CLASSIFICATION', label: 'Classify', icon: FolderTree },
  { stage: 'TAG_GENERATION', label: 'Tag', icon: Tag },
]

function stageMetaFor(stage: AgenticStage): StageMeta {
  const known = KNOWN_STAGE_META.find((m) => m.stage === stage)
  if (known) return known
  const label = stage.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return { stage, label, icon: Workflow }
}

const REFRESH_MS = 15000

type HealthTone = 'neutral' | 'ok' | 'warn' | 'danger'

function toneFor(health: StageHealth | undefined): HealthTone {
  if (!health || health.invocations === 0) return 'neutral'
  const rate = health.failures / health.invocations
  if (rate > 0.1) return 'danger'
  if (rate >= 0.02) return 'warn'
  return 'ok'
}

const DOT_CLASS: Record<HealthTone, string> = {
  neutral: 'bg-faint',
  ok: 'bg-success',
  warn: 'bg-warning',
  danger: 'bg-danger',
}

const CARD_RING: Record<HealthTone, string> = {
  neutral: 'border-line',
  ok: 'border-success/40',
  warn: 'border-warning/40',
  danger: 'border-danger/40',
}

export function AgenticPipelineSection() {
  const [view, setView] = useState<AgenticPipelineView | null>(null)
  const [expanded, setExpanded] = useState<AgenticStage | null>(null)
  const [auto, setAuto] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const res = await fetch('/api/admin/troubleshooting/agentic-pipeline')
      if (!res.ok) {
        setError('Failed to load agentic pipeline health')
        return
      }
      setError(null)
      setView(await res.json())
    } finally {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [auto, load])

  async function handleCopy(text: string, copyId: string) {
    await navigator.clipboard.writeText(text)
    setCopied(copyId)
    setTimeout(() => setCopied(null), 2000)
  }

  const stageByKey = new Map(view?.stages.map((s) => [s.stage, s]))
  const extraStages = (view?.stages ?? []).filter((s) => !KNOWN_STAGE_META.some((m) => m.stage === s.stage))
  const renderStages = [...KNOWN_STAGE_META, ...extraStages.map((s) => stageMetaFor(s.stage))]
  const activeStage = expanded ? stageByKey.get(expanded) : undefined

  return (
    <ConsoleSection
      id="agentic"
      icon={Workflow}
      title="Agentic Pipeline"
      description="Live health of the STRANDS ingestion pipeline — queue depth and which canonicalization component is failing."
      headerAside={
        <button
          type="button"
          onClick={() => setAuto((a) => !a)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${auto ? 'border-brand text-brand' : 'border-line text-muted hover:text-fg'}`}
          data-testid="agentic-autorefresh"
        >
          <RefreshCw size={12} strokeWidth={1.5} />
          {auto ? 'Live' : 'Paused'}
        </button>
      }
    >
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {view && !view.enabled && (
        <div className="rounded-[12px] border border-dashed border-line bg-card p-8 text-center text-sm text-muted" data-testid="agentic-disabled">
          Agentic pipeline is disabled — enable it on{' '}
          <a href="/pipeline-toggles" className="text-brand hover:underline">Pipeline Toggles</a>.
        </div>
      )}

      {view?.enabled && view.queueHealth && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="agentic-queue-health">
            <StatTile label="Queue depth" value={view.queueHealth.queueDepth} />
            <StatTile label="In flight" value={view.queueHealth.inFlight} />
            <StatTile label="DLQ" value={view.queueHealth.dlqDepth} tone={view.queueHealth.dlqDepth > 0 ? 'text-danger' : 'text-fg'} />
          </div>

          <div className="mt-4 flex items-stretch gap-1 overflow-x-auto pb-1" data-testid="agentic-flow">
            {renderStages.map(({ stage, label, icon: Icon }, i) => {
              const health = stageByKey.get(stage)
              const tone = toneFor(health)
              const isExpanded = expanded === stage
              return (
                <div key={stage} className="flex items-center">
                  {i > 0 && <ChevronRight size={16} strokeWidth={1.5} className="mx-1 shrink-0 text-faint" />}
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : stage)}
                    className={`flex w-[160px] flex-col gap-1.5 rounded-[12px] border bg-card p-3 text-left transition-colors ${CARD_RING[tone]} ${isExpanded ? 'ring-2 ring-brand' : ''}`}
                    data-testid={`agentic-stage-${stage}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
                        <Icon size={14} strokeWidth={1.5} /> {label}
                      </span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[tone]}`} title={tone} />
                    </div>
                    <p className="text-lg font-bold tabular-nums text-fg">{health?.invocations ?? 0}</p>
                    <p className="text-[11px] text-muted">
                      {health?.failures ?? 0} failed · {Math.round(health?.avgDurationMs ?? 0)}ms avg
                    </p>
                  </button>
                </div>
              )
            })}
          </div>

          {activeStage && (
            <div className="mt-3 rounded-[12px] border border-line bg-bg p-3" data-testid="agentic-stage-detail">
              {activeStage.lastFailure ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-fg">
                      Last failure · invoice {activeStage.lastFailure.invoiceId} · {new Date(activeStage.lastFailure.timestamp).toLocaleString()}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleCopy(activeStage.lastFailure!.message, `stage-${activeStage.stage}`)}
                      title="Copy failure message"
                    >
                      {copied === `stage-${activeStage.stage}` ? (
                        <Check size={14} className="text-green-600" strokeWidth={2} />
                      ) : (
                        <Copy size={14} strokeWidth={1.5} />
                      )}
                    </Button>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-fg leading-relaxed">{activeStage.lastFailure.message}</pre>
                  <a href="#logs" className="mt-2 inline-block text-xs text-brand hover:underline">
                    Search Ingestion Logs for this invoice ↓
                  </a>
                </>
              ) : (
                <p className="text-xs text-muted">No failures for this stage in the last hour.</p>
              )}
            </div>
          )}
        </>
      )}
    </ConsoleSection>
  )
}
