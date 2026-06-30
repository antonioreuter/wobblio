/// The corrections payload posted to `PUT /invoices/{id}` (16e). Mirrors the
/// backend `CorrectInvoiceInput`: fixed header fields + per-line edits keyed by id.
class CorrectionLine {
  const CorrectionLine({
    required this.id,
    required this.productId,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  final String id;
  final String? productId;
  final double quantity;
  final double? unitPrice;
  final double lineTotal;

  Map<String, dynamic> toJson() => {
        'id': id,
        'productId': productId,
        'quantity': quantity,
        'unitPrice': unitPrice,
        'lineTotal': lineTotal,
      };
}

class InvoiceCorrection {
  const InvoiceCorrection({
    required this.transactionDate,
    required this.total,
    required this.lines,
  });

  final String? transactionDate;
  final double? total;
  final List<CorrectionLine> lines;

  Map<String, dynamic> toJson() => {
        'transactionDate': transactionDate,
        'total': total,
        'lines': lines.map((l) => l.toJson()).toList(),
      };
}
