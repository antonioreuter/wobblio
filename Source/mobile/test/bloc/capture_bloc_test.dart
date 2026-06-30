import 'dart:typed_data';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/bloc/capture/capture_bloc.dart';
import 'package:wobblio/core/ingestion/prepared_upload.dart';
import 'package:wobblio/core/ingestion/presign_ticket.dart';
import 'package:wobblio/core/ingestion/upload_exception.dart';
import 'package:wobblio/core/ports/camera_capture.dart';
import 'package:wobblio/core/ports/document_picker.dart';
import 'package:wobblio/core/ports/gallery_picker.dart';
import 'package:wobblio/core/ports/ingestion_repository.dart';
import 'package:wobblio/core/ports/s3_uploader.dart';
import 'package:wobblio/core/ports/upload_preparer.dart';

// ── Fixtures ────────────────────────────────────────────────────────────────
final _rawBytes = Uint8List.fromList([1, 2, 3]);

final _imageUpload = PreparedUpload(
  bytes: Uint8List.fromList([9, 9]),
  sha256: 'a' * 64,
  contentType: 'image/jpeg',
);
final _pdfUpload = PreparedUpload(
  bytes: Uint8List.fromList([8, 8]),
  sha256: 'b' * 64,
  contentType: 'application/pdf',
);
const _ticket = PresignTicket(
  invoiceId: 'inv-1',
  url: 'https://s3.example/upload',
  fields: {'key': 'receipts/x.jpg'},
);

// ── Hand-rolled fakes (no mockito — stay lean, mirrors auth_bloc_test) ────────
class _FakeCamera implements ICameraCapture {
  _FakeCamera({this.bytes, this.fail = false});
  final Uint8List? bytes;
  final bool fail;
  @override
  Future<Uint8List?> capture() async {
    if (fail) throw Exception('camera denied');
    return bytes;
  }
}

class _FakeGallery implements IGalleryPicker {
  _FakeGallery({this.bytes});
  final Uint8List? bytes;
  @override
  Future<Uint8List?> pickImage() async => bytes;
}

class _FakeDocuments implements IDocumentPicker {
  _FakeDocuments({this.bytes});
  final Uint8List? bytes;
  @override
  Future<Uint8List?> pickPdf() async => bytes;
}

class _FakePreparer implements IUploadPreparer {
  int imageCalls = 0;
  int pdfCalls = 0;
  @override
  Future<PreparedUpload> prepareImage(Uint8List raw) async {
    imageCalls++;
    return _imageUpload;
  }

  @override
  Future<PreparedUpload> preparePdf(Uint8List raw) async {
    pdfCalls++;
    return _pdfUpload;
  }
}

class _FakeUploader implements IS3Uploader {
  _FakeUploader({this.error});
  final UploadException? error;
  int calls = 0;
  @override
  Future<void> upload(PresignTicket ticket, PreparedUpload upload) async {
    calls++;
    if (error != null) throw error!;
  }
}

class _FakeIngestion implements IIngestionRepository {
  _FakeIngestion({this.presignError, this.confirmError});
  final UploadException? presignError;
  final UploadException? confirmError;
  int presignCalls = 0;
  int confirmCalls = 0;
  @override
  Future<PresignTicket> presign(PreparedUpload upload) async {
    presignCalls++;
    if (presignError != null) throw presignError!;
    return _ticket;
  }

  @override
  Future<void> confirm(String invoiceId) async {
    confirmCalls++;
    if (confirmError != null) throw confirmError!;
  }
}

CaptureBloc _build({
  _FakeCamera? camera,
  _FakeGallery? gallery,
  _FakeDocuments? documents,
  _FakePreparer? preparer,
  _FakeUploader? uploader,
  _FakeIngestion? ingestion,
}) =>
    CaptureBloc(
      camera: camera ?? _FakeCamera(bytes: _rawBytes),
      gallery: gallery ?? _FakeGallery(bytes: _rawBytes),
      documents: documents ?? _FakeDocuments(bytes: _rawBytes),
      preparer: preparer ?? _FakePreparer(),
      uploader: uploader ?? _FakeUploader(),
      ingestion: ingestion ?? _FakeIngestion(),
    );

const _progress = [
  CaptureInProgress(CapturePhase.preparing),
  CaptureInProgress(CapturePhase.presigning),
  CaptureInProgress(CapturePhase.uploading),
  CaptureInProgress(CapturePhase.confirming),
];

void main() {
  group('CaptureBloc', () {
    test('initial state is idle', () {
      expect(_build().state, const CaptureIdle());
    });

    blocTest<CaptureBloc, CaptureState>(
      'camera happy path runs the full pipeline to success',
      build: _build,
      act: (bloc) => bloc.add(const CaptureFromCameraRequested()),
      expect: () => [..._progress, const CaptureSuccess('inv-1')],
    );

    test('camera uses prepareImage; document uses preparePdf', () async {
      final imagePreparer = _FakePreparer();
      final imageBloc = _build(preparer: imagePreparer);
      imageBloc.add(const CaptureFromCameraRequested());
      await imageBloc.stream.firstWhere((s) => s is CaptureSuccess);
      expect(imagePreparer.imageCalls, 1);
      expect(imagePreparer.pdfCalls, 0);
      await imageBloc.close();

      final pdfPreparer = _FakePreparer();
      final pdfBloc = _build(preparer: pdfPreparer);
      pdfBloc.add(const CaptureDocumentRequested());
      await pdfBloc.stream.firstWhere((s) => s is CaptureSuccess);
      expect(pdfPreparer.pdfCalls, 1);
      expect(pdfPreparer.imageCalls, 0);
      await pdfBloc.close();
    });

    blocTest<CaptureBloc, CaptureState>(
      'gallery happy path succeeds',
      build: () => _build(gallery: _FakeGallery(bytes: _rawBytes)),
      act: (bloc) => bloc.add(const CaptureFromGalleryRequested()),
      expect: () => [..._progress, const CaptureSuccess('inv-1')],
    );

    blocTest<CaptureBloc, CaptureState>(
      'document (pdf) happy path succeeds',
      build: () => _build(documents: _FakeDocuments(bytes: _rawBytes)),
      act: (bloc) => bloc.add(const CaptureDocumentRequested()),
      expect: () => [..._progress, const CaptureSuccess('inv-1')],
    );

    blocTest<CaptureBloc, CaptureState>(
      'cancelled pick stays idle and never advances to progress',
      build: () => _build(camera: _FakeCamera()),
      act: (bloc) => bloc.add(const CaptureFromCameraRequested()),
      expect: () => const [CaptureIdle()],
    );

    test('cancelled pick does not reach presign', () async {
      final ingestion = _FakeIngestion();
      final bloc = _build(camera: _FakeCamera(), ingestion: ingestion);
      bloc.add(const CaptureFromCameraRequested());
      await Future<void>.delayed(Duration.zero);
      expect(ingestion.presignCalls, 0);
      await bloc.close();
    });

    blocTest<CaptureBloc, CaptureState>(
      'duplicate (409) surfaces a duplicate failure',
      build: () => _build(
        ingestion: _FakeIngestion(
          presignError: const UploadException(
              UploadErrorCode.duplicate, 'already scanned',),
        ),
      ),
      act: (bloc) => bloc.add(const CaptureFromCameraRequested()),
      expect: () => const [
        CaptureInProgress(CapturePhase.preparing),
        CaptureInProgress(CapturePhase.presigning),
        CaptureFailure(UploadErrorCode.duplicate, 'already scanned'),
      ],
    );

    blocTest<CaptureBloc, CaptureState>(
      'quota (429) surfaces a quota failure',
      build: () => _build(
        ingestion: _FakeIngestion(
          presignError:
              const UploadException(UploadErrorCode.quota, 'limit reached'),
        ),
      ),
      act: (bloc) => bloc.add(const CaptureFromCameraRequested()),
      expect: () => const [
        CaptureInProgress(CapturePhase.preparing),
        CaptureInProgress(CapturePhase.presigning),
        CaptureFailure(UploadErrorCode.quota, 'limit reached'),
      ],
    );

    blocTest<CaptureBloc, CaptureState>(
      'pdf premium-required (403) surfaces a premiumRequired failure',
      build: () => _build(
        documents: _FakeDocuments(bytes: _rawBytes),
        ingestion: _FakeIngestion(
          presignError: const UploadException(
            UploadErrorCode.premiumRequired,
            'needs premium',
          ),
        ),
      ),
      act: (bloc) => bloc.add(const CaptureDocumentRequested()),
      expect: () => const [
        CaptureInProgress(CapturePhase.preparing),
        CaptureInProgress(CapturePhase.presigning),
        CaptureFailure(UploadErrorCode.premiumRequired, 'needs premium'),
      ],
    );

    blocTest<CaptureBloc, CaptureState>(
      'S3 upload failure surfaces a generic failure',
      build: () => _build(
        uploader: _FakeUploader(
          error: const UploadException(UploadErrorCode.failed, 'upload failed'),
        ),
      ),
      act: (bloc) => bloc.add(const CaptureFromCameraRequested()),
      expect: () => const [
        CaptureInProgress(CapturePhase.preparing),
        CaptureInProgress(CapturePhase.presigning),
        CaptureInProgress(CapturePhase.uploading),
        CaptureFailure(UploadErrorCode.failed, 'upload failed'),
      ],
    );

    blocTest<CaptureBloc, CaptureState>(
      'confirm failure surfaces a generic failure',
      build: () => _build(
        ingestion: _FakeIngestion(
          confirmError:
              const UploadException(UploadErrorCode.failed, 'confirm failed'),
        ),
      ),
      act: (bloc) => bloc.add(const CaptureFromCameraRequested()),
      expect: () => const [
        ..._progress,
        CaptureFailure(UploadErrorCode.failed, 'confirm failed'),
      ],
    );

    blocTest<CaptureBloc, CaptureState>(
      'native picker crash is caught as a generic failure',
      build: () => _build(camera: _FakeCamera(fail: true)),
      act: (bloc) => bloc.add(const CaptureFromCameraRequested()),
      expect: () => const [
        CaptureFailure(
          UploadErrorCode.failed,
          'Something went wrong. Please try again.',
        ),
      ],
    );

    blocTest<CaptureBloc, CaptureState>(
      'reset returns to idle from a failure',
      build: () => _build(camera: _FakeCamera(fail: true)),
      act: (bloc) => bloc
        ..add(const CaptureFromCameraRequested())
        ..add(const CaptureReset()),
      skip: 1,
      expect: () => const [CaptureIdle()],
    );
  });
}
