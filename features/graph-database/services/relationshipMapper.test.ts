import { validateRelationshipType } from '@/features/graph-database/services/relationshipMapper';

jest.mock('@/server/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { logger } = jest.requireMock('@/server/logger');

describe('validateRelationshipType', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('legacy behavior (no allowedTypes)', () => {
    it('normalizes whitespace/case and returns a known type', () => {
      expect(validateRelationshipType('works for')).toBe('WORKS_FOR');
    });

    it('accepts unknown types by normalizing them (extensible, not dropped)', () => {
      expect(validateRelationshipType('mentors')).toBe('MENTORS');
      expect(logger.debug).toHaveBeenCalled();
    });

    it('does not log for a recognized known type', () => {
      validateRelationshipType('WORKS_FOR');
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('schema-driven behavior (allowedTypes provided)', () => {
    it('returns the normalized type when it is in the allow-list', () => {
      expect(validateRelationshipType('teams with', ['TEAMS_WITH', 'INCUMBENT_ON'])).toBe('TEAMS_WITH');
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('validates against allowedTypes instead of KNOWN_RELATIONSHIP_TYPES', () => {
      // WORKS_FOR is a KNOWN type, but NOT in the provided allow-list → treated as unknown (still normalized, logged)
      expect(validateRelationshipType('WORKS_FOR', ['TEAMS_WITH'])).toBe('WORKS_FOR');
      expect(logger.debug).toHaveBeenCalled();
    });
  });
});
