import 'package:wobblio/core/reference/category.dart';

/// Port: static reference data (`GET /reference/categories`, the bundled
/// macro/sub category taxonomy — already consumed by the webapp's
/// `useBudgetReference`). Concrete adapter lives in `infrastructure/adapters/`.
abstract class IReferenceRepository {
  Future<List<Category>> fetchCategories();
}
