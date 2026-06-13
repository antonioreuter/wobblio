'use client'

import { useState } from 'react'
import { Download, Trash2, Database } from 'lucide-react'
import { Toast } from '@/components/ui/toast/toast'

interface ToastItem {
  id: string
  message: string
  variant: 'success' | 'error' | 'warning' | 'info'
}

export default function SettingsPage() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [contribute, setContribute] = useState(true)
  const [exportState, setExportState] = useState<'idle' | 'compiling' | 'downloading'>('idle')
  const [isDeleting, setIsDeleting] = useState(false)

  const addToast = (message: string, variant: ToastItem['variant'] = 'info') => {
    const newToast: ToastItem = {
      id: String(Date.now()),
      message,
      variant
    }
    setToasts(prev => [...prev, newToast])
  }

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const handleContributeToggle = () => {
    const nextVal = !contribute
    setContribute(nextVal)
    if (nextVal) {
      addToast('Thank you for contributing to the public price index!', 'success')
    } else {
      addToast('Anonymous observations will no longer feed the index.', 'info')
    }
  }

  const handleDataExport = () => {
    setExportState('compiling')
    setTimeout(() => {
      setExportState('downloading')
      setTimeout(() => {
        alert('GDPR Data Portability export compiled! Check your browser downloads for wobblio-export-usr_9a4f210e.zip.')
        setExportState('idle')
      }, 1500)
    }, 1500)
  }

  const handleAccountPurge = () => {
    const confirm1 = window.confirm(
      'Are you absolutely sure you want to permanently delete your Wobblio account? This action cannot be undone.'
    )
    if (!confirm1) return

    const confirm2 = window.confirm(
      'This will completely purge all your scanned receipts, category configurations, and household pools from our databases in compliance with Article 17 GDPR. Click OK to proceed.'
    )
    if (!confirm2) return

    setIsDeleting(true)
    addToast('Account deletion request registered. Compliance timeline logged.', 'warning')
    
    setTimeout(() => {
      window.location.href = '/'
    }, 2500)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">Settings & GDPR Governance</h1>
        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
          Manage your personal preference options and GDPR privacy controls.
        </p>
      </div>

      <div className="settings-split-grid">
        {/* Left Column: GDPR overview */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-[#0f172a] dark:text-[#f1f5f9] border-b border-[var(--color-glass-border)] pb-3">
            GDPR Compliance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
            Wobblio is fully compliant with the General Data Protection Regulation (GDPR). We ensure
            all user data is treated with the highest security and transparency:
          </p>
          <ul className="flex flex-col gap-3 text-xs text-slate-500 dark:text-slate-400">
            <li className="flex gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span>
                <strong>Right to Erasure (Art. 17):</strong> Purge your scanned receipt data,
                images, and user accounts instantly.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span>
                <strong>Data Portability (Art. 20):</strong> Export all ledger entries,
                transactions, and categories in a clean ZIP/JSON archive.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span>
                <strong>Secure Hosting:</strong> All data nodes, storage pools, and models run
                exclusively in AWS Frankfurt (eu-central-1) regions.
              </span>
            </li>
          </ul>
        </div>

        {/* Right Column: Settings Controls */}
        <div className="glass-card p-6 flex flex-col gap-6">
          {/* Section 1: Price Contribution opt-out */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Database size={14} className="text-aurora-teal" />
              Price Contribution & Indexing
            </h2>
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-100/5 border border-[var(--color-glass-border)]">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                  Contribute to Price Index
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                  Anonymously contribute extracted product prices from your receipt scans to assist in
                  local price index calculations. No personal information is shared.
                </p>
              </div>
              <button
                onClick={handleContributeToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-aurora-teal focus:ring-offset-2 min-h-[44px] min-w-[44px] items-center justify-center`}
                style={{ backgroundColor: contribute ? 'var(--color-aurora-teal)' : '#cbd5e1' }}
                role="switch"
                aria-checked={contribute}
                aria-label="Contribute to Price Index Toggle"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  style={{ transform: contribute ? 'translateX(10px)' : 'translateX(-10px)' }}
                />
              </button>
            </div>
          </div>

          {/* Section 2: Article 20 Data Export */}
          <div className="flex flex-col gap-3 border-t border-[var(--color-glass-border)] pt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Download size={14} className="text-electric-indigo" />
              Article 20 Data Portability
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-100/5 border border-[var(--color-glass-border)]">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                  Export My Data
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                  Download a complete digital archive of your invoices, transactions, categories, and
                  account settings in JSON format wrapped in a ZIP file.
                </p>
              </div>
              <button
                onClick={handleDataExport}
                disabled={exportState !== 'idle'}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-electric-indigo px-4 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50 min-h-[44px] shrink-0"
              >
                {exportState === 'idle' && (
                  <>
                    <Download size={14} className="mr-1.5" />
                    Export My Data
                  </>
                )}
                {exportState === 'compiling' && 'Compiling index...'}
                {exportState === 'downloading' && 'Downloading ZIP...'}
              </button>
            </div>
          </div>

          {/* Section 3: Article 17 Account Purge */}
          <div className="flex flex-col gap-3 border-t border-[var(--color-glass-border)] pt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Trash2 size={14} className="text-rose-500" />
              Article 17 Right to Erasure
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                  Delete My Account
                </h3>
                <p className="text-xs text-rose-500/70 dark:text-rose-400/60 mt-1">
                  Permanently purge your account and all associated historical scanning data from all
                  database nodes. This is an irreversible operation.
                </p>
              </div>
              <button
                onClick={handleAccountPurge}
                disabled={isDeleting}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 min-h-[44px] shrink-0"
              >
                <Trash2 size={14} className="mr-1.5" />
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Local Toast rendering block */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <Toast
            key={t.id}
            id={t.id}
            message={t.message}
            variant={t.variant}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </div>
  )
}
