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
    this.isDiscount = false,
    this.isDepositOrFee = false,
  });

  final String id;
  final String rawText;
  final String? productId;
  final double quantity;
  final double? unitPrice;
  final double lineTotal;
  final String? categoryName;
  final double confidence;
  // Additive (18h — Split Bill excludes these lines from assignment; the
  // pre-confirm Review screen that originally defined this model doesn't
  // read them, so they default to false rather than becoming required
  // everywhere).
  final bool isDiscount;
  final bool isDepositOrFee;

  InvoiceLineDetail copyWith({
    String? productId,
    double? quantity,
    double? unitPrice,
    double? lineTotal,
  }) =>
      InvoiceLineDetail(
        id: id,
        rawText: rawText,
        productId: productId ?? this.productId,
        quantity: quantity ?? this.quantity,
        unitPrice: unitPrice ?? this.unitPrice,
        lineTotal: lineTotal ?? this.lineTotal,
        categoryName: categoryName,
        confidence: confidence,
        isDiscount: isDiscount,
        isDepositOrFee: isDepositOrFee,
      );

  @override
  List<Object?> get props => [
        id,
        rawText,
        productId,
        quantity,
        unitPrice,
        lineTotal,
        categoryName,
        confidence,
        isDiscount,
        isDepositOrFee,
      ];
}

/// The full review payload for one invoice: zoomable photo + editable fields.
///
/// [locationLabel] and [feedbackVerdict] are additive (18b — read-only Invoice
/// Detail screen needs them for its info rows/feedback row; the pre-confirm
/// Review screen that originally defined this model doesn't read them, so
/// they default to null rather than becoming required everywhere).
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
    this.locationLabel,
    this.feedbackVerdict,
    this.processingStage,
  });

  final String id;
  final String merchant;
  final String
      status; // raw backend status (PARSED / NEEDS_REVIEW / SUSPECTED_DUPLICATE / …)
  final String? transactionDate; // ISO yyyy-MM-dd
  final double? total;
  final String currency;
  final String? imageUrl; // presigned GET (≤300s)
  final List<InvoiceLineDetail> lines;
  final String? locationLabel; // e.g. "North Brabant, Netherlands"
  final String? feedbackVerdict; // 'UP' | 'DOWN' | null, raw backend value

  /// Coarse pipeline stage while [status] is `PROCESSING` — kept in parity with
  /// [InvoiceSummary] so opening a still-processing invoice shows the same
  /// stage-accurate label the list does. Null until the backend ships it.
  final String? processingStage;

  bool get isSuspectedDuplicate => status == 'SUSPECTED_DUPLICATE';

  @override
  List<Object?> get props => [
        id,
        merchant,
        status,
        transactionDate,
        total,
        currency,
        imageUrl,
        lines,
        locationLabel,
        feedbackVerdict,
        processingStage,
      ];
}

/// A time-limited public link to share an invoice (`POST /invoices/{id}/share`).
class ShareLink extends Equatable {
  const ShareLink({required this.url, required this.expiresAt});

  final String url;
  final String expiresAt; // ISO timestamp

  @override
  List<Object?> get props => [url, expiresAt];
}
