import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

import 'package:wobblio/core/ports/gallery_picker.dart';

/// [IGalleryPicker] backed by `image_picker`'s gallery source. Returns the raw
/// image bytes; `null` when the user cancels.
class ImagePickerGalleryAdapter implements IGalleryPicker {
  ImagePickerGalleryAdapter([ImagePicker? picker])
      : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<Uint8List?> pickImage() async {
    final file = await _picker.pickImage(source: ImageSource.gallery);
    if (file == null) return null;
    return file.readAsBytes();
  }
}
