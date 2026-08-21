import { suggestSchemaKey } from './suggestSchemaKey';

describe('suggestSchemaKey', () => {
  it('maps canonical solicitation docTypes to government-pursuit', () => {
    expect(suggestSchemaKey('SOO')).toBe('government-pursuit');
    expect(suggestSchemaKey('PWS')).toBe('government-pursuit');
    expect(suggestSchemaKey('Section L')).toBe('government-pursuit');
    expect(suggestSchemaKey('Section M')).toBe('government-pursuit');
    expect(suggestSchemaKey('RFP')).toBe('government-pursuit');
    expect(suggestSchemaKey('Q&A')).toBe('government-pursuit');
    expect(suggestSchemaKey('QASP')).toBe('government-pursuit');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(suggestSchemaKey('soo')).toBe('government-pursuit');
    expect(suggestSchemaKey('  Draft   PWS  ')).toBe('government-pursuit');
    expect(suggestSchemaKey('section l')).toBe('government-pursuit');
  });

  it('maps common full-name spellings to government-pursuit', () => {
    expect(suggestSchemaKey('Statement of Objectives')).toBe('government-pursuit');
    expect(suggestSchemaKey('Request for Proposal')).toBe('government-pursuit');
    expect(suggestSchemaKey('Performance Work Statement')).toBe('government-pursuit');
  });

  it('falls back to general for non-solicitation types', () => {
    expect(suggestSchemaKey('Recipe')).toBe('general');
    expect(suggestSchemaKey('Memo')).toBe('general');
    expect(suggestSchemaKey('Other')).toBe('general');
    expect(suggestSchemaKey('Research Paper')).toBe('general');
  });

  it('falls back to general for null/undefined/empty input', () => {
    expect(suggestSchemaKey(null)).toBe('general');
    expect(suggestSchemaKey(undefined)).toBe('general');
    expect(suggestSchemaKey('')).toBe('general');
  });
});
