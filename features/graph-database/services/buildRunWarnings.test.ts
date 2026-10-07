import {
  generateExtractionWarnings,
  generateResolutionWarnings,
} from '@/features/graph-database/services/buildRunWarnings';
import type {
  ExtractionRunStats,
  ResolutionRunStats,
} from '@/features/graph-database/types';

describe('buildRunWarnings', () => {
  describe('generateExtractionWarnings', () => {
    it('should return NO_ENTITIES_EXTRACTED error when no entities extracted', () => {
      const stats: ExtractionRunStats = {
        chunksProcessed: 10,
        entitiesCreated: 0,
        entitiesMerged: 0,
        conceptsCreated: 0,
        relationshipsCreated: 0,
        byDocument: {},
      };

      const warnings = generateExtractionWarnings(stats);

      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe('NO_ENTITIES_EXTRACTED');
      expect(warnings[0].severity).toBe('error');
    });

    it('should return LOW_ENTITY_COUNT info when entity density is low', () => {
      const stats: ExtractionRunStats = {
        chunksProcessed: 100,
        entitiesCreated: 10, // 0.1 entities per chunk
        entitiesMerged: 0,
        conceptsCreated: 5,
        relationshipsCreated: 0,
        byDocument: {},
      };

      const warnings = generateExtractionWarnings(stats);

      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe('LOW_ENTITY_COUNT');
      expect(warnings[0].severity).toBe('info');
      expect(warnings[0].details.entityDensity).toBe(0.1);
    });

    it('should return no warnings when extraction is healthy', () => {
      const stats: ExtractionRunStats = {
        chunksProcessed: 10,
        entitiesCreated: 20, // 2 entities per chunk
        entitiesMerged: 0,
        conceptsCreated: 15,
        relationshipsCreated: 10,
        byDocument: {
          'doc-1': { entities: 10, concepts: 8, chunks: 5, extractedAt: new Date().toISOString() },
          'doc-2': { entities: 10, concepts: 7, chunks: 5, extractedAt: new Date().toISOString() },
        },
      };

      const warnings = generateExtractionWarnings(stats);

      expect(warnings.length).toBe(0);
    });

    it('should return per-document warning when a document has no entities', () => {
      const stats: ExtractionRunStats = {
        chunksProcessed: 10,
        entitiesCreated: 10,
        entitiesMerged: 0,
        conceptsCreated: 5,
        relationshipsCreated: 0,
        byDocument: {
          'doc-1': { entities: 10, concepts: 5, chunks: 5, extractedAt: new Date().toISOString() },
          'doc-2': { entities: 0, concepts: 0, chunks: 5, extractedAt: new Date().toISOString() },
        },
      };

      const warnings = generateExtractionWarnings(stats);

      const docWarning = warnings.find(w => w.code === 'NO_ENTITIES_EXTRACTED' && w.severity === 'warning');
      expect(docWarning).toBeDefined();
      expect(docWarning?.details.documentId).toBe('doc-2');
    });
  });

  describe('generateResolutionWarnings', () => {
    const baseStats: ResolutionRunStats = {
      expectedDocPairs: 1,
      actualDocPairs: 1,
      candidatesGenerated: 10,
      identityEdges: 5,
      similarEdges: 3,
      relatedEdges: 2,
      unrelatedPairs: 0,
      avgConfidence: 0.9,
      minConfidence: 0.85,
      maxConfidence: 0.95,
      lowConfidenceIdentityCount: 0,
      duplicateResolutions: 0,
      decisionBreakdown: {
        identity: 5,
        similar: 3,
        related: 2,
        unrelated: 0,
      },
      byEntityType: {},
    };

    it('should return DOC_PAIR_MISMATCH error when doc pairs differ', () => {
      const stats: ResolutionRunStats = {
        ...baseStats,
        expectedDocPairs: 5,
        actualDocPairs: 3,
      };

      const warnings = generateResolutionWarnings(stats);

      const mismatch = warnings.find(w => w.code === 'DOC_PAIR_MISMATCH');
      expect(mismatch).toBeDefined();
      expect(mismatch?.severity).toBe('error');
      expect(mismatch?.details.difference).toBe(-2);
    });

    it('should return DUPLICATE_RESOLUTIONS error when duplicates exist', () => {
      const stats: ResolutionRunStats = {
        ...baseStats,
        duplicateResolutions: 3,
      };

      const warnings = generateResolutionWarnings(stats);

      const dup = warnings.find(w => w.code === 'DUPLICATE_RESOLUTIONS');
      expect(dup).toBeDefined();
      expect(dup?.severity).toBe('error');
      expect(dup?.details.duplicateCount).toBe(3);
    });

    it('should return LOW_CONFIDENCE_IDENTITY warning when many low confidence edges', () => {
      const stats: ResolutionRunStats = {
        ...baseStats,
        identityEdges: 10,
        lowConfidenceIdentityCount: 5, // 50% low confidence
      };

      const warnings = generateResolutionWarnings(stats);

      const lowConf = warnings.find(w => w.code === 'LOW_CONFIDENCE_IDENTITY');
      expect(lowConf).toBeDefined();
      expect(lowConf?.severity).toBe('warning');
    });

    it('should return ALL_SAME_DECISION warning when all decisions are identical', () => {
      const stats: ResolutionRunStats = {
        ...baseStats,
        candidatesGenerated: 10,
        decisionBreakdown: {
          identity: 10,
          similar: 0,
          related: 0,
          unrelated: 0,
        },
      };

      const warnings = generateResolutionWarnings(stats);

      const allSame = warnings.find(w => w.code === 'ALL_SAME_DECISION');
      expect(allSame).toBeDefined();
      expect(allSame?.severity).toBe('warning');
      expect(allSame?.details.decisionType).toBe('IDENTITY');
    });

    it('should return HIGH_UNRELATED_RATIO info when many unrelated', () => {
      const stats: ResolutionRunStats = {
        ...baseStats,
        decisionBreakdown: {
          identity: 2,
          similar: 1,
          related: 1,
          unrelated: 6, // 60% unrelated
        },
      };

      const warnings = generateResolutionWarnings(stats);

      const highUnrelated = warnings.find(w => w.code === 'HIGH_UNRELATED_RATIO');
      expect(highUnrelated).toBeDefined();
      expect(highUnrelated?.severity).toBe('info');
    });

    it('should return no warnings when resolution is healthy', () => {
      const warnings = generateResolutionWarnings(baseStats);

      expect(warnings.length).toBe(0);
    });
  });

});
