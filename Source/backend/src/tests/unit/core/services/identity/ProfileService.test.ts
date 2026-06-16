import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { ProfileService } from '@core/services/identity/ProfileService';
import type { IAppUserRepository, OnboardingInput, OnboardingProfile } from '@core/ports/identity/IAppUserRepository';
import type { IRegionReference } from '@core/ports/data-intelligence/IRegionReference';
import { InvalidProfileError, UserNotFoundError } from '@core/domain/errors';

const validInput: OnboardingInput = {
  fullName: 'Ada Lovelace',
  country: 'NL',
  regionCode: 'NL-NB',
  language: 'nl',
  currency: 'EUR',
  birthdate: '1990-12-10',
  consent: true,
};

describe('ProfileService', () => {
  let mockUserRepo: MockedObject<IAppUserRepository>;
  let mockRegionRef: MockedObject<IRegionReference>;
  let sut: ProfileService;

  beforeEach(() => {
    mockUserRepo = {
      findByCognitoSub: vi.fn(),
      insertUser: vi.fn(),
      promoteToPremium: vi.fn(),
      getProfile: vi.fn(),
      completeOnboarding: vi.fn(),
    };
    mockRegionRef = {
      listCountries: vi.fn(),
      listSubdivisions: vi.fn(),
      isValidRegion: vi.fn().mockResolvedValue(true),
    };
    sut = new ProfileService(mockUserRepo, mockRegionRef);
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
      expect(mockRegionRef.isValidRegion).toHaveBeenCalledWith('NL', 'NL-NB');
      expect(mockUserRepo.completeOnboarding).toHaveBeenCalledWith('sub-1', validInput);
    });

    it('rejects a region that is not valid for the country', async () => {
      mockRegionRef.isValidRegion.mockResolvedValue(false);
      await expect(sut.completeOnboarding('sub-1', { ...validInput, regionCode: 'US-CA' })).rejects.toBeInstanceOf(
        InvalidProfileError,
      );
      expect(mockUserRepo.completeOnboarding).not.toHaveBeenCalled();
    });

    it('skips region validation when no region is supplied', async () => {
      await sut.completeOnboarding('sub-1', { ...validInput, regionCode: '' });
      expect(mockRegionRef.isValidRegion).not.toHaveBeenCalled();
      expect(mockUserRepo.completeOnboarding).toHaveBeenCalled();
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
