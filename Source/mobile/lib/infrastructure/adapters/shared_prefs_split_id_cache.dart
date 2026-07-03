import 'package:shared_preferences/shared_preferences.dart';

import 'package:wobblio/core/ports/split_id_cache.dart';

/// [ISplitIdCache] over `shared_preferences`. Key format mirrors the
/// webapp's `localStorage` cache (`STORAGE_PREFIX = 'wobblio:split:'`) so the
/// on-disk convention stays recognizable across platforms, even though the
/// two stores are entirely separate.
class SharedPrefsSplitIdCache implements ISplitIdCache {
  const SharedPrefsSplitIdCache();

  @override
  Future<String?> read(String invoiceId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_key(invoiceId));
  }

  @override
  Future<void> write(String invoiceId, String splitId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(invoiceId), splitId);
  }

  String _key(String invoiceId) => 'wobblio:split:$invoiceId';
}
