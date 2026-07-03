import 'package:equatable/equatable.dart';

/// One entry from `GET /reference/categories` (the bundled macro/sub category
/// taxonomy). Only `id`/`name` are modelled — mobile only needs these for the
/// budget category picker in this slice; `parentId` can be added later if a
/// screen needs the macro/sub hierarchy.
class Category extends Equatable {
  const Category({required this.id, required this.name});

  final String id;
  final String name;

  @override
  List<Object?> get props => [id, name];
}
