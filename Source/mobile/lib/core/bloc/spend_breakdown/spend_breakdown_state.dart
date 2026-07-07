part of 'spend_breakdown_bloc.dart';

enum SpendBreakdownStatus { loading, success, failure, forbidden }

class SpendBreakdownState extends Equatable {
  const SpendBreakdownState({
    this.status = SpendBreakdownStatus.loading,
    this.isPremium = false,
    this.homeCountry = '',
    this.homeRegion = '',
    this.period = SpendPeriod.last90d,
    this.allRegions = false,
    this.categoryId,
    this.categoryName,
    this.merchantId,
    this.merchantName,
    this.itemCategoryId,
    this.itemCategoryName,
    this.breakdown,
    this.showUpsell = false,
  });

  final SpendBreakdownStatus status;
  final bool isPremium;
  final String homeCountry;
  final String homeRegion;
  final SpendPeriod period;
  final bool allRegions;
  final String? categoryId;
  final String? categoryName;
  final String? merchantId;
  final String? merchantName;
  final String? itemCategoryId;
  final String? itemCategoryName;
  final SpendBreakdown? breakdown;
  final bool showUpsell;

  /// The active drill level, derived from which selection ids are set.
  SpendLevel get level {
    if (categoryId == null) return SpendLevel.categories;
    if (merchantId == null) return SpendLevel.merchants;
    if (itemCategoryId == null) return SpendLevel.itemCategories;
    return SpendLevel.items;
  }

  SpendBreakdownState copyWith({
    SpendBreakdownStatus? status,
    bool? isPremium,
    String? homeCountry,
    String? homeRegion,
    SpendPeriod? period,
    bool? allRegions,
    String? categoryId,
    String? categoryName,
    String? merchantId,
    String? merchantName,
    String? itemCategoryId,
    String? itemCategoryName,
    SpendBreakdown? breakdown,
    bool? showUpsell,
    bool clearCategory = false,
    bool clearMerchant = false,
    bool clearItemCategory = false,
  }) {
    return SpendBreakdownState(
      status: status ?? this.status,
      isPremium: isPremium ?? this.isPremium,
      homeCountry: homeCountry ?? this.homeCountry,
      homeRegion: homeRegion ?? this.homeRegion,
      period: period ?? this.period,
      allRegions: allRegions ?? this.allRegions,
      categoryId: clearCategory ? null : (categoryId ?? this.categoryId),
      categoryName: clearCategory ? null : (categoryName ?? this.categoryName),
      merchantId: clearMerchant ? null : (merchantId ?? this.merchantId),
      merchantName: clearMerchant ? null : (merchantName ?? this.merchantName),
      itemCategoryId:
          clearItemCategory ? null : (itemCategoryId ?? this.itemCategoryId),
      itemCategoryName: clearItemCategory
          ? null
          : (itemCategoryName ?? this.itemCategoryName),
      breakdown: breakdown ?? this.breakdown,
      showUpsell: showUpsell ?? this.showUpsell,
    );
  }

  @override
  List<Object?> get props => [
        status,
        isPremium,
        homeCountry,
        homeRegion,
        period,
        allRegions,
        categoryId,
        categoryName,
        merchantId,
        merchantName,
        itemCategoryId,
        itemCategoryName,
        breakdown,
        showUpsell,
      ];
}
