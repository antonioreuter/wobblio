import 'package:equatable/equatable.dart';

/// A product autocomplete hit from `GET /products/search` — the canonical product
/// a line can be re-pointed to in the review screen's line bottom sheet (16e).
class ProductMatch extends Equatable {
  const ProductMatch({required this.productId, required this.displayName, required this.brand});

  final String productId;
  final String displayName;
  final String? brand;

  String get label => brand == null || brand!.isEmpty ? displayName : '$displayName · $brand';

  @override
  List<Object?> get props => [productId, displayName, brand];
}
