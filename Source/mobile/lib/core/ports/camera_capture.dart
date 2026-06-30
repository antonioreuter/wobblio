import 'dart:typed_data';

/// Port: take a photo with the device camera.
///
/// Concrete adapter (`image_picker`) lives in `infrastructure/adapters/`.
/// Returns the raw captured bytes, or `null` when the user cancels.
abstract class ICameraCapture {
  Future<Uint8List?> capture();
}
