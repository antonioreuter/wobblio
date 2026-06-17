import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { WeeklyAdvisorService } from '@core/services/ai/WeeklyAdvisorService';
import type { IWeeklyAdvisorRepository, AdvisorFactsData } from '@core/ports/ai/IWeeklyAdvisorRepository';
import type { IBedrockConverse } from '@core/ports/ai/IBedrockConverse';

const facts: AdvisorFactsData = {
  spendThisWeek: 10, spendLastWeek: 20, budgets: [], priceFindings: [], splitRoute: null,
};

describe('WeeklyAdvisorService', () => {
  let advisor: MockedObject<IWeeklyAdvisorRepository>;
  let converse: MockedObject<IBedrockConverse>;
  let sut: WeeklyAdvisorService;

  beforeEach(() => {
    advisor = {
      listEligibleTenants: vi.fn().mockResolvedValue([]),
      gatherFacts: vi.fn().mockResolvedValue(facts),
      save: vi.fn(),
      getCurrent: vi.fn(),
    };
    converse = {
      converse: vi.fn().mockResolvedValue({ content: 'Buy milk at Lidl.', inputTokens: 5, outputTokens: 10, modelId: 'm', durationMs: 1 }),
    };
    sut = new WeeklyAdvisorService(advisor, converse, 'auxiliary-model', 'PROMPT', 'v1');
  });

  it('does nothing when no tenant is eligible', async () => {
    const outcome = await sut.run('2026-06-17');
    expect(outcome).toEqual({ eligible: 0, generated: 0 });
    expect(converse.converse).not.toHaveBeenCalled();
  });

  it('generates and saves a card for each eligible tenant', async () => {
    advisor.listEligibleTenants.mockResolvedValue([{ tenantId: 't1', language: 'en', currency: 'EUR' }]);

    const outcome = await sut.run('2026-06-17');

    expect(outcome).toEqual({ eligible: 1, generated: 1 });
    expect(advisor.gatherFacts).toHaveBeenCalledWith('t1', '2026-06-15');
    expect(converse.converse).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'WEEKLY_ADVISOR', modelId: 'auxiliary-model', systemPrompt: 'PROMPT', promptVersion: 'v1' }),
    );
    expect(advisor.save).toHaveBeenCalledWith('t1', '2026-06-15', 'Buy milk at Lidl.');
  });

  it('processes every eligible tenant through the bounded pool', async () => {
    const cohort = Array.from({ length: 20 }, (_, i) => ({ tenantId: `t${i}`, language: 'en', currency: 'EUR' }));
    advisor.listEligibleTenants.mockResolvedValue(cohort);

    const outcome = await sut.run('2026-06-17');

    expect(outcome).toEqual({ eligible: 20, generated: 20 });
    expect(converse.converse).toHaveBeenCalledTimes(20);
    expect(advisor.save).toHaveBeenCalledTimes(20);
  });

  it('isolates a single tenant failure from the rest of the batch', async () => {
    advisor.listEligibleTenants.mockResolvedValue([{ tenantId: 't1', language: 'en', currency: 'EUR' }]);
    advisor.gatherFacts.mockRejectedValue(new Error('db down'));

    const outcome = await sut.run('2026-06-17');

    expect(outcome).toEqual({ eligible: 1, generated: 0 });
    expect(advisor.save).not.toHaveBeenCalled();
  });
});
