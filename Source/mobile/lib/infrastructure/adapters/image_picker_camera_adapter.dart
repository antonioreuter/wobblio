import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

import 'package:wobblio/core/ports/camera_capture.dart';

/// [ICameraCapture] backed by `image_picker`'s camera source. Returns the raw
/// captured bytes (the EXIF strip + compression happens later in
/// [IUploadPreparer], never here); `null` when the user backs out.
class ImagePickerCameraAdapter implements ICameraCapture {
  ImagePickerCameraAdapter([ImagePicker? picker])
      : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<Uint8List?> capture() async {
    final file = await _picker.pickImage(source: ImageSource.camera);
    if (file == null) return null;
    return file.readAsBytes();
  }
}
