import 'dart:typed_data';

/// Port: pick a **PDF** receipt/invoice document.
///
/// PDFs are the multipage path — a single PDF file is one invoice whose pages
/// are parsed server-side (images stay strictly single-page). Concrete adapter
/// (`file_picker`) lives in `infrastructure/adapters/`. Returns the raw PDF
/// bytes, or `null` when the user cancels.
abstract class IDocumentPicker {
  Future<Uint8List?> pickPdf();
}
