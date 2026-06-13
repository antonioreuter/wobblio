'use client'

import { useState } from 'react'
import { CheckSquare, Upload, Sparkles, AlertTriangle, X } from 'lucide-react'
import { ParseReviewScreen } from '@/components/screens/parse-review-screen'
import { cn } from '@/lib/cn'

export default function ReviewPage() {
  const [step, setStep] = useState<'list' | 'upload' | 'processing' | 'review'>('list')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null)
  
  const [simulatedFields] = useState([
    { label: 'Merchant', value: 'Vapiano Oostpoort', confidence: 'confirmed' as const },
    { label: 'Date', value: '2026-06-12', confidence: 'confirmed' as const },
    { label: 'Total', value: '€42.50', confidence: 'low' as const, isAmount: true },
    { label: 'Category', value: 'Dining', confidence: 'low' as const },
  ])
  const [tags, setTags] = useState<string[]>(['lunch-split'])

  const triggerUpload = () => {
    setStep('upload')
  }

  const startProcessing = () => {
    setStep('processing')
    setUploadProgress(10)
    
    // Simulate upload and parse progress
    const timer = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer)
          setTimeout(() => {
            setStep('review')
          }, 500)
          return 100
        }
        return prev + 15
      })
    }, 300)
  }

  const handleConfirm = () => {
    alert('Receipt successfully verified and saved to database!')
    setStep('list')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">Awaiting Check</h1>
        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
          Review extracted receipt items and confidence flags before committing to database ledger.
        </p>
      </div>

      {step === 'list' && (
        <div className="awaiting-grid">
          {/* Left Column: Cards Grid */}
          <div className="flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Pending Ingestion Items
              </h2>
              <button
                onClick={triggerUpload}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-aurora-teal px-4 text-xs font-semibold text-white hover:bg-[#0f766e] min-h-[44px]"
              >
                <Upload size={14} className="mr-1.5" />
                Scan New Receipt
              </button>
            </div>

            <div className="awaiting-cards-container">
              <div
                onClick={() => {
                  setSelectedReceipt('Vapiano')
                  setStep('review')
                }}
                className="glass-card p-5 hover:border-amber-500/30 cursor-pointer transition-all flex flex-col justify-between gap-4 group relative overflow-hidden"
              >
                <div className="flex justify-between items-start">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <AlertTriangle size={18} />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    Low Confidence
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#0f172a] dark:text-[#f1f5f9] group-hover:text-amber-500 transition-colors">
                    Vapiano Oostpoort
                  </h3>
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Uploaded 2 hours ago • 4 line items
                  </p>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-[var(--color-glass-border)] text-xs">
                  <span className="text-slate-400">Total amount to verify</span>
                  <span className="font-bold text-amber-500 font-mono">€42.50</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sidebar Stats */}
          <div className="glass-card p-5 flex flex-col gap-5">
            <h3 className="text-sm font-bold text-[#0f172a] dark:text-[#f1f5f9] border-b border-[var(--color-glass-border)] pb-3">
              Extraction Pipeline
            </h3>

            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Monthly Scan Quota</span>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Quota Used</span>
                  <span>7 / 10 scans</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-aurora-teal h-full" style={{ width: '70%' }}></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--color-glass-border)]">
                <div>
                  <span className="text-[10px] text-slate-400 block">Avg OCR Speed</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">4.8s</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">AI Accuracy</span>
                  <span className="text-sm font-bold text-teal-500">94.2%</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/10 text-xs text-indigo-500 leading-normal">
                💡 <strong>Privacy Tip:</strong> Camera EXIF tags and GPS data are automatically
                stripped by the client before receipt upload.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Ingestion Stepper Modal Overlay */}
      {(step === 'upload' || step === 'processing') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-0 md:p-6">
          <div className="glass-card w-full h-full md:h-auto md:max-w-lg p-8 relative flex flex-col justify-center items-center gap-6 text-center">
            
            {/* Close Button */}
            <button
              onClick={() => setStep('list')}
              className="absolute top-4 right-4 rounded-full p-2 text-slate-500 hover:bg-slate-100/10"
              aria-label="Cancel upload"
            >
              <X size={20} />
            </button>

            {step === 'upload' && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10 text-electric-indigo">
                  <Upload size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#0f172a] dark:text-[#f1f5f9]">
                    Upload Receipt
                  </h3>
                  <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2 max-w-sm">
                    Select a photo of your receipt to run AI line-item parsing. JPG, PNG, and PDF supported.
                  </p>
                </div>

                {/* Simulated file selector area */}
                <button
                  onClick={startProcessing}
                  className="w-full py-8 border-2 border-dashed border-[var(--color-glass-border)] rounded-xl hover:bg-slate-100/5 transition-all text-[#64748b] text-sm flex flex-col items-center justify-center gap-2"
                >
                  <span className="font-semibold text-electric-indigo">Click to choose image</span>
                  <span>or drag and drop here</span>
                </button>
              </>
            )}

            {step === 'processing' && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10 text-aurora-teal animate-pulse">
                  <Sparkles size={32} className="animate-spin duration-1000" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#0f172a] dark:text-[#f1f5f9]">
                    AI Extraction Pipeline
                  </h3>
                  <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">
                    Running OCR algorithms, locating bounding boxes, and mapping categories...
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-aurora-teal h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs font-bold font-mono text-[#64748b] dark:text-[#94a3b8]">
                  {uploadProgress}% processed
                </span>
              </>
            )}

          </div>
        </div>
      )}

      {/* Parse Verification Drawer / Bottom Sheet */}
      {step === 'review' && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60"
            onClick={() => setStep('list')}
          />

          {/* Responsive Panel */}
          <div
            className={cn(
              "absolute z-50 flex flex-col bg-white dark:bg-[#111827] shadow-2xl transition-all duration-300 border-[var(--color-glass-border)]",
              // Desktop: right drawer panel
              "lg:inset-y-0 lg:right-0 lg:w-[480px] lg:border-l lg:h-full lg:rounded-none",
              // Mobile: bottom sheet
              "inset-x-0 bottom-0 h-[85vh] rounded-t-[20px] border-t"
            )}
          >
            {/* Drawer Header with Swipe/Dismiss Handle on Mobile */}
            <div className="flex flex-col items-center p-4 border-b border-[#e2e8f0] dark:border-[#334155]">
              <div className="h-1.5 w-12 rounded-full bg-slate-400/30 dark:bg-slate-500/30 mb-3 lg:hidden" />
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-aurora-teal flex items-center gap-1.5">
                  <CheckSquare size={16} />
                  {selectedReceipt ? `${selectedReceipt} Verification` : 'Receipt Verification'}
                </span>
                <button
                  onClick={() => setStep('list')}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100/10"
                  aria-label="Dismiss drawer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Parse Verification component body */}
            <div className="flex-1 overflow-y-auto">
              <ParseReviewScreen
                fields={simulatedFields}
                tags={tags}
                tagVocabulary={['lunch-split', 'office-exp', 'weekly-groceries']}
                onAddTag={t => setTags(prev => [...prev, t])}
                onRemoveTag={t => setTags(prev => prev.filter(x => x !== t))}
                onConfirm={handleConfirm}
                className="min-h-0 h-full pb-safe"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
