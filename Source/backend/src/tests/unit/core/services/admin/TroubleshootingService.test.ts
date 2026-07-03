import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { TroubleshootingService } from '@core/services/admin/TroubleshootingService';
import type { IIngestionLogReader } from '@core/ports/troubleshooting/IIngestionLogReader';
import type { IWorkerRuntimeControl, LogLevelState } from '@core/ports/troubleshooting/IWorkerRuntimeControl';
import type { IQueueHealthSource } from '@core/ports/troubleshooting/IQueueHealthSource';
import type { IWorkerMetricsSource } from '@core/ports/troubleshooting/IWorkerMetricsSource';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError } from '@core/domain/errors';

const ACTOR = { id: 'admin-1', email: 'ops@wobblio.com' };
const state = (over: Partial<LogLevelState> = {}): LogLevelState => ({
  configuredLevel: 'info',
  effectiveLevel: 'info',
  expiresAt: null,
  ...over,
});

describe('TroubleshootingService', () => {
  let logs: MockedObject<IIngestionLogReader>;
  let control: MockedObject<IWorkerRuntimeControl>;
  let queues: MockedObject<IQueueHealthSource>;
  let metrics: MockedObject<IWorkerMetricsSource>;
  let audit: MockedObject<IAdminAuditLog>;
  let sut: TroubleshootingService;

  beforeEach(() => {
    logs = { query: vi.fn().mockResolvedValue([]) };
    control = { getLogLevel: vi.fn().mockResolvedValue(state()), setLogLevel: vi.fn().mockResolvedValue(undefined) };
    queues = { getHealth: vi.fn().mockResolvedValue({ queueDepth: 0, inFlight: 0, dlqDepth: 0 }) };
    metrics = { getErrorSeries: vi.fn().mockResolvedValue([]) };
    audit = { record: vi.fn().mockResolvedValue(undefined), list: vi.fn() };
    sut = new TroubleshootingService(logs, control, queues, metrics, audit);
  });

  describe('queryLogs', () => {
    it('clamps the window, limit, and unknown level to safe defaults', async () => {
      await sut.queryLogs({ minutes: 99999, minLevel: 'bogus' as never, search: '  ', limit: 9999 });
      expect(logs.query).toHaveBeenCalledWith({
        minutes: 24 * 60,
        minLevel: 'info',
        search: null,
        limit: 200,
      });
    });

    it('passes a trimmed search and a valid level through', async () => {
      await sut.queryLogs({ minLevel: 'error', search: '  inv-42 ' });
      expect(logs.query).toHaveBeenCalledWith(
        expect.objectContaining({ minLevel: 'error', search: 'inv-42' }),
      );
    });

    it('treats an omitted search as no filter', async () => {
      await sut.queryLogs({ minLevel: 'error' });
      expect(logs.query).toHaveBeenCalledWith(expect.objectContaining({ search: null }));
    });
  });

  describe('setLogLevel', () => {
    it('rejects an unknown level without touching the worker', async () => {
      await expect(sut.setLogLevel(ACTOR, 'trace')).rejects.toBeInstanceOf(InvalidAdminInputError);
      expect(control.setLogLevel).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('sets debug with a bounded auto-revert deadline and audits the change', async () => {
      await sut.setLogLevel(ACTOR, 'debug', 30);
      const [level, expiresAt] = control.setLogLevel.mock.calls[0];
      expect(level).toBe('debug');
      expect(expiresAt).toBeInstanceOf(Date);
      const minutes = Math.round(((expiresAt as Date).getTime() - Date.now()) / 60000);
      expect(minutes).toBe(30);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'loglevel.change', after: 'debug', target: 'ingestion-worker' }),
      );
    });

    it('caps an over-long debug ttl', async () => {
      await sut.setLogLevel(ACTOR, 'debug', 99999);
      const expiresAt = control.setLogLevel.mock.calls[0][1] as Date;
      const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);
      expect(minutes).toBe(8 * 60);
    });

    it('sets a non-debug level permanently (no deadline)', async () => {
      await sut.setLogLevel(ACTOR, 'info');
      expect(control.setLogLevel).toHaveBeenCalledWith('info', null);
    });

    it('defaults an omitted debug ttl to 60 minutes', async () => {
      await sut.setLogLevel(ACTOR, 'debug');
      const expiresAt = control.setLogLevel.mock.calls[0][1] as Date;
      const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);
      expect(minutes).toBe(60);
    });
  });

  describe('passthrough reads', () => {
    it('clamps the metric window', async () => {
      await sut.getErrorSeries(9999);
      expect(metrics.getErrorSeries).toHaveBeenCalledWith(48);
    });

    it('clamps a non-finite metric window down to the minimum', async () => {
      await sut.getErrorSeries(NaN);
      expect(metrics.getErrorSeries).toHaveBeenCalledWith(1);
    });

    it('delegates queue health and log level', async () => {
      await sut.getQueueHealth();
      await sut.getLogLevel();
      expect(queues.getHealth).toHaveBeenCalled();
      expect(control.getLogLevel).toHaveBeenCalled();
    });
  });
});
