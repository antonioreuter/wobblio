import 'dart:typed_data';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import 'package:wobblio/core/ingestion/prepared_upload.dart';
import 'package:wobblio/core/ingestion/upload_exception.dart';
import 'package:wobblio/core/ports/camera_capture.dart';
import 'package:wobblio/core/ports/document_picker.dart';
import 'package:wobblio/core/ports/gallery_picker.dart';
import 'package:wobblio/core/ports/ingestion_repository.dart';
import 'package:wobblio/core/ports/s3_uploader.dart';
import 'package:wobblio/core/ports/upload_preparer.dart';

part 'capture_event.dart';
part 'capture_state.dart';

/// Orchestrates the capture-first vertical slice (spec 16c): pick bytes →
/// prepare (EXIF strip + ≤1MB JPEG for images, hash for PDFs) → presign →
/// S3 upload → confirm → [CaptureSuccess]. Depends on ports only; the camera,
/// file pickers, image pipeline, S3 client, and HTTP all live behind
/// abstractions (`.claude/rules/flutter-architecture-guard.md`).
class CaptureBloc extends Bloc<CaptureEvent, CaptureState> {
  CaptureBloc({
    required ICameraCapture camera,
    required IGalleryPicker gallery,
    required IDocumentPicker documents,
    required IUploadPreparer preparer,
    required IS3Uploader uploader,
    required IIngestionRepository ingestion,
  })  : _camera = camera,
        _gallery = gallery,
        _documents = documents,
        _preparer = preparer,
        _uploader = uploader,
        _ingestion = ingestion,
        super(const CaptureIdle()) {
    on<CaptureFromCameraRequested>(_onCamera);
    on<CaptureFromGalleryRequested>(_onGallery);
    on<CaptureDocumentRequested>(_onDocument);
    on<CaptureReset>((_, emit) => emit(const CaptureIdle()));
  }

  final ICameraCapture _camera;
  final IGalleryPicker _gallery;
  final IDocumentPicker _documents;
  final IUploadPreparer _preparer;
  final IS3Uploader _uploader;
  final IIngestionRepository _ingestion;

  Future<void> _onCamera(
          CaptureFromCameraRequested event, Emitter<CaptureState> emit,) =>
      _run(emit, _camera.capture, _preparer.prepareImage);

  Future<void> _onGallery(
          CaptureFromGalleryRequested event, Emitter<CaptureState> emit,) =>
      _run(emit, _gallery.pickImage, _preparer.prepareImage);

  Future<void> _onDocument(
          CaptureDocumentRequested event, Emitter<CaptureState> emit,) =>
      _run(emit, _documents.pickPdf, _preparer.preparePdf);

  Future<void> _run(
    Emitter<CaptureState> emit,
    Future<Uint8List?> Function() pick,
    Future<PreparedUpload> Function(Uint8List) prepare,
  ) async {
    try {
      final raw = await pick();
      if (raw == null) {
        emit(const CaptureIdle()); // cancelled — never reaches presign
        return;
      }
      emit(const CaptureInProgress(CapturePhase.preparing));
      final prepared = await prepare(raw);
      emit(const CaptureInProgress(CapturePhase.presigning));
      final ticket = await _ingestion.presign(prepared);
      emit(const CaptureInProgress(CapturePhase.uploading));
      await _uploader.upload(ticket, prepared);
      emit(const CaptureInProgress(CapturePhase.confirming));
      await _ingestion.confirm(ticket.invoiceId);
      emit(CaptureSuccess(ticket.invoiceId));
    } on UploadException catch (error) {
      emit(CaptureFailure(error.code, error.message));
    } catch (_) {
      // Picker/native failures (denied permission, decode error) never reach the
      // user as a crash — surface a retryable generic failure.
      emit(const CaptureFailure(
          UploadErrorCode.failed, 'Something went wrong. Please try again.',),);
    }
  }
}
