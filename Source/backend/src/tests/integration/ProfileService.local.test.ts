import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { ProfileService } from '@core/services/ProfileService';
import { AppUserRepositoryAdapter } from '@infrastructure/adapters/AppUserRepositoryAdapter';
import type { OnboardingInput } from '@core/ports/IAppUserRepository';

const validInput: OnboardingInput = {
  fullName: 'Ada Lovelace',
  country: 'NL',
  language: 'nl',
  currency: 'EUR',
  birthdate: '1990-12-10',
  consent: true,
};

describe('ProfileService — Postgres end-to-end', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'wobblio_local',
      user: 'wobblio_dev',
      password: 'wobblio_dev_secret',
      max: 2,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  const provisionUser = async (): Promise<string> => {
    const sub = `sub-${randomUUID()}`;
    await new AppUserRepositoryAdapter(pool).insertUser(sub, `${sub}@test.nl`, 'ACTIVE');
    return sub;
  };

  it('reports onboarded:false with default role/status for a freshly provisioned user', async () => {
    const sub = await provisionUser();
    const service = new ProfileService(new AppUserRepositoryAdapter(pool));

    const profile = await service.getProfile(sub);

    expect(profile.onboarded).toBe(false);
    expect(profile.role).toBe('STANDARD');
    expect(profile.status).toBe('ACTIVE');
  });

  it('marks the user onboarded and persists the profile (the contract auth.ts reads)', async () => {
    const sub = await provisionUser();
    const service = new ProfileService(new AppUserRepositoryAdapter(pool));

    await service.completeOnboarding(sub, validInput);
    const profile = await service.getProfile(sub);

    expect(profile.onboarded).toBe(true);
    expect(profile.fullName).toBe('Ada Lovelace');
    expect(profile.country).toBe('NL');
    expect(profile.birthdate).not.toBeNull();
    expect(profile.role).toBe('STANDARD');
    expect(profile.status).toBe('ACTIVE');
  });
});
