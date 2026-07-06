import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/ingestion/invoice_status.dart';

void main() {
  group('statusViewFor processing stage', () {
    test('shows the stage-accurate label while PROCESSING', () {
      const expected = {
        'RECEIVED': 'Received — starting…',
        'READING': 'Reading your receipt…',
        'MATCHING': 'Matching products & prices…',
        'FINALIZING': 'Finishing up…',
      };
      expected.forEach((stage, label) {
        final view = statusViewFor('PROCESSING', processingStage: stage);
        expect(view.label, label);
        expect(view.tone, StatusTone.processing);
      });
    });

    test('falls back to the generic label without/with an unknown stage', () {
      for (final stage in [null, 'SOMETHING_NEW']) {
        final view = statusViewFor('PROCESSING', processingStage: stage);
        expect(view.label, 'Reading receipt…');
        expect(view.tone, StatusTone.processing);
      }
    });

    test('ignores a stale stage once the status is terminal', () {
      final view = statusViewFor('PARSED', processingStage: 'READING');
      expect(view.label, 'Ready');
      expect(view.tone, StatusTone.success);
    });
  });
}
