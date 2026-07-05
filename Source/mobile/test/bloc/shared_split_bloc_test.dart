import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wobblio/core/bloc/shared_split/shared_split_bloc.dart';
import 'package:wobblio/core/error/api_exception.dart';
import 'package:wobblio/core/ports/split_repository.dart';
import 'package:wobblio/core/splitting/shared_split.dart';
import 'package:wobblio/core/splitting/split_allocation.dart';
import 'package:wobblio/core/splitting/split_summary.dart';

const _sharedFixture = SharedSplit(
  merchant: 'AH To Go',
  date: '2026-06-30',
  currency: 'EUR',
  grandTotal: 10,
  participants: const [
    SplitParticipant(
      name: 'Sam',
      subtotal: 3,
      fees: 0.5,
      total: 3.5,
      items: [
        SplitItem(lineId: 'l1', label: 'Bananen', qty: 1, fraction: 1, amount: 3),
      ],
    ),
  ],
);

// Only getSharedSplit is exercised here; the rest throw to catch any stray call.
class _FakeSplits implements ISplitRepository {
  _FakeSplits({this.result, this.error});

  final SharedSplit? result;
  final ApiException? error;
  int calls = 0;

  @override
  Future<SharedSplit> getSharedSplit(String token) async {
    calls++;
    if (error != null) throw error!;
    return result!;
  }

  @override
  Future<String> createSplit(String invoiceId) => throw UnimplementedError();
  @override
  Future<List<SplitAllocation>> getSplit(String invoiceId, String splitId) =>
      throw UnimplementedError();
  @override
  Future<void> setLineAllocations(String invoiceId, String splitId,
          String lineId, List<LineAllocation> allocations,) =>
      throw UnimplementedError();
  @override
  Future<SplitSummary> getSummary(String invoiceId, String splitId) =>
      throw UnimplementedError();
  @override
  Future<String> getWhatsAppText(String invoiceId, String splitId) =>
      throw UnimplementedError();
  @override
  Future<String> createShareLink(String invoiceId, String splitId) =>
      throw UnimplementedError();
}

SharedSplitBloc _build(_FakeSplits splits) =>
    SharedSplitBloc(splits: splits, token: 'tok123');

void main() {
  group('SharedSplitBloc', () {
    blocTest<SharedSplitBloc, SharedSplitState>(
      'resolves the token into a ready state',
      build: () => _build(_FakeSplits(result: _sharedFixture)),
      act: (bloc) => bloc.add(const SharedSplitStarted()),
      skip: 1,
      verify: (bloc) {
        expect(bloc.state.status, SharedSplitStatus.ready);
        expect(bloc.state.split, _sharedFixture);
      },
    );

    blocTest<SharedSplitBloc, SharedSplitState>(
      'a 404 maps to notFound (invalid/expired link)',
      build: () => _build(
        _FakeSplits(error: const ApiException('gone', statusCode: 404)),
      ),
      act: (bloc) => bloc.add(const SharedSplitStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.status, SharedSplitStatus.notFound),
    );

    blocTest<SharedSplitBloc, SharedSplitState>(
      'a non-404 error maps to failure',
      build: () => _build(
        _FakeSplits(error: const ApiException('boom', statusCode: 500)),
      ),
      act: (bloc) => bloc.add(const SharedSplitStarted()),
      skip: 1,
      verify: (bloc) => expect(bloc.state.status, SharedSplitStatus.failure),
    );
  });
}
