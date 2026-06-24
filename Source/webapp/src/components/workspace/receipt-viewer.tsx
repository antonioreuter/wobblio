'use client'

import { useEffect, useRef, useState } from 'react'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

interface ReceiptViewerProps {
  imageUrl: string
}

const MIN_SCALE = 1
const MAX_SCALE = 4
const STEP = 0.25

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

// Presigned S3 URLs carry the object key (with its real extension) in the path; the
// query string holds the signature. A PDF can't render in an <img>, so detect it and
// hand it to the browser's native PDF viewer in an <iframe>.
const isPdfUrl = (url: string): boolean => {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return url.split('?')[0].toLowerCase().endsWith('.pdf')
  }
}

export function ReceiptViewer({ imageUrl }: ReceiptViewerProps) {
  if (isPdfUrl(imageUrl)) {
    return (
      <div className="receipt-stage receipt-stage--pdf" data-testid="receipt-pdf">
        <iframe className="receipt-stage-pdf" src={imageUrl} title="Invoice PDF" />
        <a className="btn btn--outline receipt-pdf-open" href={imageUrl} target="_blank" rel="noreferrer">
          Open PDF in new tab
        </a>
      </div>
    )
  }

  return <ReceiptImageViewer imageUrl={imageUrl} />
}

function ReceiptImageViewer({ imageUrl }: ReceiptViewerProps) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const applyScale = (next: number) => {
    const clamped = clampScale(next)
    setScale(clamped)
    if (clamped === MIN_SCALE) setOffset({ x: 0, y: 0 })
  }

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }) }

  // Native non-passive listener: React's onWheel is passive, so preventDefault() is ignored.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      applyScale(scale + (e.deltaY < 0 ? STEP : -STEP))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [scale])

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= MIN_SCALE) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    })
  }

  const onPointerUp = () => { setDragging(false); dragStart.current = null }

  const zoomable = scale > MIN_SCALE

  return (
    <>
      <div
        ref={stageRef}
        className="receipt-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: zoomable ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="receipt-stage-img"
          src={imageUrl}
          alt="Receipt"
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: dragging ? 'none' : 'transform 0.18s var(--ease-out)',
          }}
        />

        <div className="receipt-zoom-bar" onClick={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Zoom out" onClick={() => applyScale(scale - STEP)} disabled={scale <= MIN_SCALE} data-testid="receipt-zoom-out">
            <ZoomOut size={18} />
          </button>
          <button type="button" className="receipt-zoom-reset" aria-label="Reset zoom" onClick={reset}>
            {Math.round(scale * 100)}%
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => applyScale(scale + STEP)} disabled={scale >= MAX_SCALE} data-testid="receipt-zoom-in">
            <ZoomIn size={18} />
          </button>
          <span className="receipt-zoom-sep" />
          <button type="button" aria-label="Fit" onClick={reset}>
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    </>
  )
}
