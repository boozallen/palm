import { isUseCase, UseCase, USE_CASE_LABELS, USE_CASE_ORDER } from '@/features/shared/types/use-case';

describe('use-case vocabulary', () => {
  it('is a closed set of nine categories', () => {
    expect(Object.values(UseCase)).toHaveLength(9);
  });

  it('labels every category', () => {
    Object.values(UseCase).forEach((useCase) => {
      expect(USE_CASE_LABELS[useCase]).toBeTruthy();
    });
  });

  it('renders every category exactly once, with Unclassified last', () => {
    expect(USE_CASE_ORDER).toHaveLength(9);
    expect(new Set(USE_CASE_ORDER).size).toBe(9);
    expect(USE_CASE_ORDER[8]).toBe(UseCase.Unclassified);
  });

  it('accepts a value inside the set', () => {
    expect(isUseCase('engineering')).toBe(true);
  });

  // The columns are String?, so the database cannot reject a hallucinated
  // category. The guard is the only thing standing between a bad model response
  // and a cast that would put an unrenderable key into a Record lookup.
  it('rejects a value outside the set', () => {
    expect(isUseCase('proposalCaptureXL')).toBe(false);
  });

  it('rejects null, undefined and non-strings', () => {
    expect(isUseCase(null)).toBe(false);
    expect(isUseCase(undefined)).toBe(false);
    expect(isUseCase(7)).toBe(false);
  });
});
