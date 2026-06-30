import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';

import 'package:wobblio/core/ports/document_picker.dart';

/// [IDocumentPicker] backed by `file_picker`, restricted to PDFs. Reads bytes
/// directly (`withData: true`) so the flow is byte-oriented like the image path;
/// `null` when the user cancels.
class FilePickerDocumentAdapter implements IDocumentPicker {
  FilePickerDocumentAdapter([FilePicker? picker])
      : _picker = picker ?? FilePicker.platform;

  final FilePicker _picker;

  @override
  Future<Uint8List?> pickPdf() async {
    final result = await _picker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
      withData: true,
    );
    return result?.files.single.bytes;
  }
}
