import 'package:equatable/equatable.dart';

/// A single parsed line on the review screen (`GET /invoices/{id}`). [confidence]
/// (0..1) drives the amber low-confidence highlight; [productId] is the canonical
/// product the line maps to, editable via product search (16e).
class InvoiceLineDetail extends Equatable {
  const InvoiceLineDetail({
    required this.id,
    required this.rawText,
    required this.productId,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
    required this.categoryName,
    required this.confidence,
  });

  final String id;
  final String rawText;
  final String? productId;
  final double quantity;
  final double? unitPrice;
  final double lineTotal;
  final String? categoryName;
  final double confidence;

  InvoiceLineDetail copyWith({
    String? productId,
    double? quantity,
    double? unitPrice,
    double? lineTotal,
  }) => InvoiceLineDetail(
        id: id,
        rawText: rawText,
        productId: productId ?? this.productId,
        quantity: quantity ?? this.quantity,
        unitPrice: unitPrice ?? this.unitPrice,
        lineTotal: lineTotal ?? this.lineTotal,
        categoryName: categoryName,
        confidence: confidence,
      );

  @override
  List<Object?> get props =>
      [id, rawText, productId, quantity, unitPrice, lineTotal, categoryName, confidence];
}

/// The full review payload for one invoice: zoomable photo + editable fields.
class InvoiceDetail extends Equatable {
  const InvoiceDetail({
    required this.id,
    required this.merchant,
    required this.status,
    required this.transactionDate,
    required this.total,
    required this.currency,
    required this.imageUrl,
    required this.lines,
  });

  final String id;
  final String merchant;
  final String status; // raw backend status (PARSED / NEEDS_REVIEW / SUSPECTED_DUPLICATE / …)
  final String? transactionDate; // ISO yyyy-MM-dd
  final double? total;
  final String currency;
  final String? imageUrl; // presigned GET (≤300s)
  final List<InvoiceLineDetail> lines;

  bool get isSuspectedDuplicate => status == 'SUSPECTED_DUPLICATE';

  @override
  List<Object?> get props =>
      [id, merchant, status, transactionDate, total, currency, imageUrl, lines];
}
