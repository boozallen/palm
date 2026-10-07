import {
  computeHasNameAliasOverlap,
  computeSameName,
  computeSameType,
  computeSameDocument,
  computeAllSignals,
  getSharedNames,
} from '@/features/graph-database/services/signalComputation';
import type { Entity } from '@/features/graph-database/types';
import { EntityType } from '@/features/graph-database/types';

describe('signalComputation', () => {
  // Note: context is now on MENTIONS edge, not on Entity node
  const mockEntity1: Entity = {
    id: '1',
    name: 'DHA',
    normalizedName: 'dha',
    type: EntityType.ORGANIZATION,
    description: 'Defense Health Agency',
    aliases: ['Defense Health Agency', 'the agency'],
    documentId: 'doc1',
    mentionCount: 5,
    firstSeenAt: new Date('2025-01-01'),
  };

  const mockEntity2: Entity = {
    id: '2',
    name: 'Defense Health Agency',
    normalizedName: 'defense health agency',
    type: EntityType.ORGANIZATION,
    description: 'US military healthcare',
    aliases: ['DHA', 'agency'],
    documentId: 'doc1',
    mentionCount: 3,
    firstSeenAt: new Date('2025-01-02'),
  };

  describe('computeHasNameAliasOverlap', () => {
    it('should return true when main names overlap with aliases', () => {
      // e1.name='DHA' matches e2.aliases=['DHA', ...]
      const hasOverlap = computeHasNameAliasOverlap(mockEntity1, mockEntity2);
      expect(hasOverlap).toBe(true);
    });

    it('should return true when alias matches main name', () => {
      // e1.aliases=['Defense Health Agency'] matches e2.name='Defense Health Agency'
      const hasOverlap = computeHasNameAliasOverlap(mockEntity1, mockEntity2);
      expect(hasOverlap).toBe(true);
    });

    it('should return false when no overlap exists', () => {
      const entity3: Entity = { ...mockEntity1, name: 'XYZ', aliases: ['ABC', 'DEF'] };
      const hasOverlap = computeHasNameAliasOverlap(entity3, mockEntity2);
      expect(hasOverlap).toBe(false);
    });

    it('should be case-insensitive', () => {
      const entity3: Entity = { ...mockEntity1, name: 'dha', aliases: [] };
      const entity4: Entity = { ...mockEntity2, name: 'DHA', aliases: [] };
      const hasOverlap = computeHasNameAliasOverlap(entity3, entity4);
      expect(hasOverlap).toBe(true);
    });
  });

  describe('getSharedNames', () => {
    it('should return array of shared names', () => {
      const shared = getSharedNames(mockEntity1, mockEntity2);
      expect(shared).toContain('dha');
      expect(shared).toContain('defense health agency');
      expect(shared.length).toBe(2); // Only 'dha' and 'defense health agency' overlap
    });

    it('should return empty array when no overlap', () => {
      const entity3: Entity = { ...mockEntity1, name: 'XYZ', aliases: ['ABC'] };
      const shared = getSharedNames(entity3, mockEntity2);
      expect(shared).toEqual([]);
    });
  });

  describe('computeSameName', () => {
    it('should return true for matching normalized names', () => {
      const entity3: Entity = { ...mockEntity1, normalizedName: 'dha' };
      const entity4: Entity = { ...mockEntity2, normalizedName: 'dha' };
      const same = computeSameName(entity3, entity4);
      expect(same).toBe(true);
    });

    it('should return false for different normalized names', () => {
      const same = computeSameName(mockEntity1, mockEntity2);
      expect(same).toBe(false);
    });
  });

  describe('computeSameType', () => {
    it('should return true for matching types', () => {
      const same = computeSameType(mockEntity1, mockEntity2);
      expect(same).toBe(true); // Both ORGANIZATION
    });

    it('should return false for different types', () => {
      const entity3: Entity = { ...mockEntity1, type: EntityType.PERSON };
      const same = computeSameType(entity3, mockEntity2);
      expect(same).toBe(false);
    });
  });

  describe('computeSameDocument', () => {
    it('should return true for same document', () => {
      const same = computeSameDocument(mockEntity1, mockEntity2);
      expect(same).toBe(true);
    });

    it('should return false for different documents', () => {
      const entity3: Entity = { ...mockEntity1, documentId: 'doc2' };
      const same = computeSameDocument(entity3, mockEntity2);
      expect(same).toBe(false);
    });
  });

  describe('computeAllSignals', () => {
    it('should compute all signals with provided embedding similarity', () => {
      const signals = computeAllSignals(mockEntity1, mockEntity2, 0.92);

      expect(signals.embedding_similarity).toBe(0.92);
      expect(signals.has_name_alias_overlap).toBe(true);
      expect(signals.same_name).toBe(false); // 'dha' !== 'defense health agency'
      expect(signals.same_type).toBe(true);
      expect(signals.same_document).toBe(true);
      expect(signals.sharedNames).toBeDefined();
      expect(signals.sharedNames!.length).toBeGreaterThan(0);
    });

    it('should include shared names in result', () => {
      const signals = computeAllSignals(mockEntity1, mockEntity2, 0.85);

      expect(signals.sharedNames).toContain('dha');
      expect(signals.sharedNames).toContain('defense health agency');
    });
  });
});
