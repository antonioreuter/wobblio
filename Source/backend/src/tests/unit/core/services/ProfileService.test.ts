import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ProfileService } from '@core/services/ProfileService';
import type { IAppUserRepository, OnboardingInput, OnboardingProfile } from '@core/ports/IAppUserRepository';
import { InvalidProfileError, UserNotFoundError } from '@core/domain/errors';

const validInput: OnboardingInput = {
  fullName: 'Ada Lovelace',
  country: 'NL',
  language: 'nl',
  currency: 'EUR',
  birthdate: '1990-12-10',
  consent: true,
};

describe('ProfileService', () => {
  let mockUserRepo: MockedObject<IAppUserRepository>;
  let sut: ProfileService;

  beforeEach(() => {
    mockUserRepo = {
      findByCognitoSub: vi.fn(),
      insertUser: vi.fn(),
      promoteToPremium: vi.fn(),
      getProfile: vi.fn(),
      completeOnboarding: vi.fn(),
    };
    sut = new ProfileService(mockUserRepo);
  });

  describe('getProfile', () => {
    it('returns the stored profile', async () => {
      const profile: OnboardingProfile = {
        fullName: 'Ada Lovelace', country: 'NL', language: 'nl', currency: 'EUR',
        birthdate: '1990-12-10', onboarded: true, role: 'STANDARD', status: 'ACTIVE',
      };
      mockUserRepo.getProfile.mockResolvedValue(profile);

      await expect(sut.getProfile('sub-1')).resolves.toEqual(profile);
      expect(mockUserRepo.getProfile).toHaveBeenCalledWith('sub-1');
    });

    it('throws UserNotFoundError when the user is missing', async () => {
      mockUserRepo.getProfile.mockResolvedValue(null);
      await expect(sut.getProfile('ghost')).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe('completeOnboarding', () => {
    it('persists the profile to the database only (no Cognito write)', async () => {
      await sut.completeOnboarding('sub-1', validInput);
      expect(mockUserRepo.completeOnboarding).toHaveBeenCalledWith('sub-1', validInput);
    });

    it.each([
      ['blank full name', { ...validInput, fullName: '  ' }],
      ['bad country code', { ...validInput, country: 'NLD' }],
      ['blank language', { ...validInput, language: '' }],
      ['bad currency code', { ...validInput, currency: 'EU' }],
      ['missing consent', { ...validInput, consent: false }],
      ['malformed birthdate', { ...validInput, birthdate: '12-10-1990' }],
      ['missing birthdate', { ...validInput, birthdate: undefined }],
      ['future birthdate', { ...validInput, birthdate: '3000-01-01' }],
    ])('rejects %s without touching the repository', async (_label, input) => {
      await expect(sut.completeOnboarding('sub-1', input as OnboardingInput)).rejects.toBeInstanceOf(
        InvalidProfileError,
      );
      expect(mockUserRepo.completeOnboarding).not.toHaveBeenCalled();
    });
  });
});
