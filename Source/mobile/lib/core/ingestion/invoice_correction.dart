/// The corrections payload posted to `PUT /invoices/{id}` (16e). Mirrors the
/// backend `CorrectInvoiceInput`: fixed header fields + per-line edits keyed by id.
class CorrectionLine {
  const CorrectionLine({
    required this.id,
    required this.productId,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
    this.sizePackQuantity,
    this.sizeBaseUnit,
  });

  final String id;
  final String? productId;
  final double quantity;
  final double? unitPrice;
  final double lineTotal;
  // "Set size" (09/05): a user-annotated pack size in base units + its unit (KG|L|PIECE). When both
  // are set the backend stamps size_source = USER; size is identity metadata only, never a price.
  final double? sizePackQuantity;
  final String? sizeBaseUnit;

  Map<String, dynamic> toJson() => {
        'id': id,
        'productId': productId,
        'quantity': quantity,
        'unitPrice': unitPrice,
        'lineTotal': lineTotal,
        if (sizePackQuantity != null && sizeBaseUnit != null)
          'size': {'packQuantity': sizePackQuantity, 'baseUnit': sizeBaseUnit},
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
