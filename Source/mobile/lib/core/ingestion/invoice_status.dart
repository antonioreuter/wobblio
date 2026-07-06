/// Visual tone for an invoice status pill. Mirrors the webapp's `StatusTone`
/// (`invoice-data.ts`): processing = shimmer/indigo, success = green,
/// warning = amber, danger = red.
enum StatusTone { processing, success, warning, danger }

/// A status as shown to the customer: a [tone] + a plain-language [label].
class InvoiceStatusView {
  const InvoiceStatusView(this.tone, this.label);

  final StatusTone tone;
  final String label;
}

/// Backend status → customer-facing pill, mirroring the canonical webapp
/// `STATUS_MAP` (`Source/webapp/src/lib/invoice-map.ts`).
///
/// NB: `NEEDS_REVIEW` deliberately collapses into the green "Ready" pill (same
/// as the webapp) — there is no user action that flips it to PARSED, so an amber
/// "needs review" badge would imply an unfinishable task. The correction screen
/// (16e) is still reachable by tapping the row / thumbs-down.
const Map<String, InvoiceStatusView> _statusMap = {
  'PROCESSING': InvoiceStatusView(StatusTone.processing, 'Reading receipt…'),
  'PARSED': InvoiceStatusView(StatusTone.success, 'Ready'),
  'NEEDS_REVIEW': InvoiceStatusView(StatusTone.success, 'Ready'),
  'FAILED_PROCESSING': InvoiceStatusView(StatusTone.danger, "Couldn't read"),
  'SUSPECTED_DUPLICATE':
      InvoiceStatusView(StatusTone.warning, 'Possible duplicate'),
  'DISCARDED': InvoiceStatusView(StatusTone.danger, 'Removed'),
};

/// Stage-accurate labels while `PROCESSING` (specs/fixes/07.03), mirroring the
/// webapp `PROCESSING_STAGE_LABELS`. Honest stages, never fake percentages; an
/// unknown/absent stage keeps the generic PROCESSING label so a backend
/// addition can't break older clients.
const Map<String, String> _processingStageLabels = {
  'RECEIVED': 'Received — starting…',
  'READING': 'Reading your receipt…',
  'MATCHING': 'Matching products & prices…',
  'FINALIZING': 'Finishing up…',
};

InvoiceStatusView statusViewFor(String raw, {String? processingStage}) {
  if (raw == 'PROCESSING' && processingStage != null) {
    final stageLabel = _processingStageLabels[processingStage];
    if (stageLabel != null) {
      return InvoiceStatusView(StatusTone.processing, stageLabel);
    }
  }
  return _statusMap[raw] ?? InvoiceStatusView(StatusTone.processing, raw);
}

/// Only `PROCESSING` is non-terminal — every other status (including
/// `NEEDS_REVIEW`) is a resting state, so polling can stop. An unknown status is
/// treated as terminal so a backend addition never makes the client poll forever.
bool isTerminalStatus(String raw) => raw != 'PROCESSING';
