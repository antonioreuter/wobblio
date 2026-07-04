import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { AdminModelService } from '@core/services/admin/AdminModelService';
import type { IModelRegistry } from '@core/ports/ai/IModelRegistry';
import type { IAdminAuditLog } from '@core/ports/admin/IAdminAuditLog';
import { InvalidAdminInputError, UnknownAdminTargetError } from '@core/domain/errors';

const ACTOR = { id: 'admin-1', email: 'admin@wobblio.nl' };

describe('AdminModelService', () => {
  let registry: MockedObject<IModelRegistry>;
  let audit: MockedObject<IAdminAuditLog>;
  let sut: AdminModelService;

  beforeEach(() => {
    registry = { getModelId: vi.fn(), getModelIdOptional: vi.fn(), getAll: vi.fn(), setModelId: vi.fn() };
    audit = { record: vi.fn(), list: vi.fn() };
    sut = new AdminModelService(registry, audit);
  });

  it('lists all roles with current ids', async () => {
    registry.getAll.mockResolvedValue({
      vision_parser: 'v1',
      vision_fallback: 'vf1',
      pdf_parser: 'p1',
      auxiliary: 'a1',
      insight: null,
      embedder: 'e1',
    });
    const list = await sut.list();
    expect(list).toHaveLength(6);
    const insight = list.find((e) => e.role === 'insight');
    expect(insight?.modelId).toBeNull();
    // each role carries curated options for the dropdown
    expect(list.every((e) => e.options.length > 0)).toBe(true);
    const vision = list.find((e) => e.role === 'vision_parser');
    expect(vision?.options.some((o) => o.id.startsWith('qwen'))).toBe(true);
    // PDFs have a dedicated, document-capable swap entry
    const pdf = list.find((e) => e.role === 'pdf_parser');
    expect(pdf?.modelId).toBe('p1');
    expect(pdf?.options.length).toBeGreaterThan(0);
  });

  it('swaps a valid role, writing SSM and auditing old → new', async () => {
    registry.getAll.mockResolvedValue({
      vision_parser: 'old-vision',
      vision_fallback: 'vf1',
      pdf_parser: 'p1',
      auxiliary: 'a1',
      insight: 'i1',
      embedder: 'e1',
    });

    const id = await sut.swap(ACTOR, 'vision_parser', '  new-vision  ');

    expect(id).toBe('new-vision');
    expect(registry.setModelId).toHaveBeenCalledWith('vision_parser', 'new-vision');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'model.swap',
        target: 'vision_parser',
        before: 'old-vision',
        after: 'new-vision',
      }),
    );
  });

  it('rejects an unknown role without writing', async () => {
    await expect(sut.swap(ACTOR, 'sonnet', 'x')).rejects.toBeInstanceOf(UnknownAdminTargetError);
    expect(registry.setModelId).not.toHaveBeenCalled();
  });

  it('rejects an empty model id without writing', async () => {
    await expect(sut.swap(ACTOR, 'auxiliary', '   ')).rejects.toBeInstanceOf(InvalidAdminInputError);
    expect(registry.setModelId).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects a non-string model id', async () => {
    await expect(sut.swap(ACTOR, 'auxiliary', 123)).rejects.toBeInstanceOf(InvalidAdminInputError);
    expect(registry.setModelId).not.toHaveBeenCalled();
  });

  it('history reads the audit log filtered to model.swap', async () => {
    audit.list.mockResolvedValue([]);
    await sut.history();
    expect(audit.list).toHaveBeenCalledWith('model.swap', expect.any(Number));
  });
});
