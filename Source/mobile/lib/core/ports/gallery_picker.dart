import 'dart:typed_data';

/// Port: pick an existing receipt **image** from the photo library.
///
/// Concrete adapter (`image_picker`) lives in `infrastructure/adapters/`.
/// Returns the raw image bytes, or `null` when the user cancels.
abstract class IGalleryPicker {
  Future<Uint8List?> pickImage();
}
