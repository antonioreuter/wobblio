// Bedrock Converse caps a document block at ~4.5 MB. The admin-editable max_pdf_bytes is
// hard-clamped to this so an operator can't raise it into the range where a PDF passes our
// pre-AI checks but Bedrock rejects it → system-fault quarantine (§06 review).
export const BEDROCK_MAX_PDF_BYTES = 4_500_000;

// Best-effort PDF page count from raw bytes — no dependency (hexagonal: pure domain).
// Counts page objects (`/Type /Page`, excluding `/Pages` page-tree nodes). Compressed /
// object-stream PDFs (1.5+) can hide page objects inside streams, in which case this
// undercounts — the safe direction for a defence-in-depth cap, since it never falsely
// rejects a small PDF. Returns at least 1 for any non-empty input so a valid single-page
// document is never read as zero pages.
const PAGE_OBJECT_RE = /\/Type\s*\/Page(?![sA-Za-z])/g;

export function countPdfPages(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const text = new TextDecoder('latin1').decode(bytes);
  const matches = text.match(PAGE_OBJECT_RE);
  return Math.max(matches?.length ?? 0, 1);
}
