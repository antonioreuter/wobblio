import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const send = vi.fn();
vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: class { send = send; },
  GetParameterCommand: class { constructor(public input: unknown) {} },
  GetParametersCommand: class { constructor(public input: unknown) {} },
  PutParameterCommand: class { constructor(public input: unknown) {} },
}));

const { SsmModelRegistryAdapter } = await import('@infrastructure/adapters/ai/SsmModelRegistryAdapter');

const param = (value: string) => ({ Parameter: { Value: value } });

describe('SsmModelRegistryAdapter', () => {
  beforeEach(() => {
    send.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads SSM once and serves the cached id on subsequent calls', async () => {
    send.mockResolvedValue(param('qwen.qwen3-vl-235b-a22b'));
    const sut = new SsmModelRegistryAdapter('eu-west-1');

    expect(await sut.getModelId('vision_parser')).toBe('qwen.qwen3-vl-235b-a22b');
    expect(await sut.getModelId('vision_parser')).toBe('qwen.qwen3-vl-235b-a22b');

    // The worker holds one module-scoped instance across invocations, so this is the difference
    // between one SSM round-trip per container and one per message (fix 07/04 §3).
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('re-reads after the TTL expires, so an admin model swap lands without a cold start', async () => {
    send.mockResolvedValueOnce(param('old-model')).mockResolvedValueOnce(param('new-model'));
    const sut = new SsmModelRegistryAdapter('eu-west-1');

    expect(await sut.getModelId('auxiliary')).toBe('old-model');
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(await sut.getModelId('auxiliary')).toBe('new-model');

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('still serves from cache just before the TTL boundary', async () => {
    send.mockResolvedValue(param('old-model'));
    const sut = new SsmModelRegistryAdapter('eu-west-1');

    await sut.getModelId('auxiliary');
    vi.advanceTimersByTime(5 * 60_000 - 1_000);
    await sut.getModelId('auxiliary');

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('caches each role separately', async () => {
    send.mockResolvedValueOnce(param('vision')).mockResolvedValueOnce(param('aux'));
    const sut = new SsmModelRegistryAdapter('eu-west-1');

    expect(await sut.getModelId('vision_parser')).toBe('vision');
    expect(await sut.getModelId('auxiliary')).toBe('aux');
    expect(await sut.getModelId('vision_parser')).toBe('vision');

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('throws when a required parameter is missing', async () => {
    send.mockResolvedValue({ Parameter: {} });
    const sut = new SsmModelRegistryAdapter('eu-west-1');

    await expect(sut.getModelId('vision_parser')).rejects.toThrow(/is missing/);
  });

  describe('getModelIdOptional', () => {
    it('fails open to null for an unprovisioned role and does not cache the miss', async () => {
      send.mockRejectedValue(Object.assign(new Error('not found'), { name: 'ParameterNotFound' }));
      const sut = new SsmModelRegistryAdapter('eu-west-1');

      expect(await sut.getModelIdOptional('vision_fallback')).toBeNull();
      expect(await sut.getModelIdOptional('vision_fallback')).toBeNull();

      // Not cached: provisioning the tier later must take effect, and the call is cheap.
      expect(send).toHaveBeenCalledTimes(2);
    });

    it('caches a provisioned optional role and honours the same TTL', async () => {
      send.mockResolvedValueOnce(param('sonnet')).mockResolvedValueOnce(param('sonnet-next'));
      const sut = new SsmModelRegistryAdapter('eu-west-1');

      expect(await sut.getModelIdOptional('vision_fallback')).toBe('sonnet');
      expect(await sut.getModelIdOptional('vision_fallback')).toBe('sonnet');
      expect(send).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5 * 60_000 + 1);
      expect(await sut.getModelIdOptional('vision_fallback')).toBe('sonnet-next');
      expect(send).toHaveBeenCalledTimes(2);
    });

    it('propagates a non-ParameterNotFound failure rather than silently disabling the tier', async () => {
      send.mockRejectedValue(Object.assign(new Error('denied'), { name: 'AccessDeniedException' }));
      const sut = new SsmModelRegistryAdapter('eu-west-1');

      await expect(sut.getModelIdOptional('vision_fallback')).rejects.toThrow('denied');
    });
  });

  it('setModelId writes through and refreshes the cache for a read-after-write', async () => {
    send.mockResolvedValue({});
    const sut = new SsmModelRegistryAdapter('eu-west-1');

    await sut.setModelId('auxiliary', 'swapped-model');
    expect(await sut.getModelId('auxiliary')).toBe('swapped-model');

    expect(send).toHaveBeenCalledTimes(1); // the Put only — the read was served from cache
  });
});
