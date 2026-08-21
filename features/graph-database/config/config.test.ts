import { storageModel } from '@/features/graph-database/config/storage-model.config';
import { signalsConfig } from '@/features/graph-database/config/signals.config';
import { getExtractionRules, getResolutionRules } from '@/features/graph-database/utils/signals';
import { resolutionPolicy } from '@/features/graph-database/config/resolution-policy.config';
import { queryRules } from '@/features/graph-database/config/query-rules.config';
import { validateAllConfigs } from '@/features/graph-database/config/validate';

describe('Configuration Infrastructure', () => {
  describe('storage-model.config', () => {
    it('should export storageModel with nodeTypes', () => {
      expect(storageModel.nodeTypes).toBeDefined();
      expect(Object.keys(storageModel.nodeTypes).length).toBeGreaterThan(0);
    });

    it('should define ENTITY node type', () => {
      expect(storageModel.nodeTypes.ENTITY).toBeDefined();
      expect(storageModel.nodeTypes.ENTITY.category).toBe('ENTITY');
      expect(storageModel.nodeTypes.ENTITY.label).toBe('Entity');
    });

    it('should export storageModel with edgeTypes', () => {
      expect(storageModel.edgeTypes).toBeDefined();
      expect(Object.keys(storageModel.edgeTypes).length).toBeGreaterThan(0);
    });

    it('should define IDENTITY edge type with unified schema', () => {
      expect(storageModel.edgeTypes.IDENTITY).toBeDefined();
      expect(storageModel.edgeTypes.IDENTITY.neoType).toBe('IDENTITY');
      expect(storageModel.edgeTypes.IDENTITY.isTransitive).toBe(true);

      // Verify unified properties
      const props = storageModel.edgeTypes.IDENTITY.properties;
      expect(props.confidence).toBe('number');
      expect(props.cosineSimScore).toBe('number');
      expect(props.sharedAliases).toBe('string[]');
      expect(props.rationale).toBe('string');
    });

    it('should have identical properties for all resolution edges', () => {
      const identityProps = storageModel.edgeTypes.IDENTITY.properties;
      const similarProps = storageModel.edgeTypes.SIMILAR.properties;
      const relatedProps = storageModel.edgeTypes.RELATED_RESOLUTION.properties;

      // All should have same property keys
      expect(Object.keys(identityProps).sort()).toEqual(Object.keys(similarProps).sort());
      expect(Object.keys(identityProps).sort()).toEqual(Object.keys(relatedProps).sort());
    });
  });

  describe('signals.config', () => {
    it('should export signalsConfig with signals array', () => {
      expect(signalsConfig.signals).toBeDefined();
      expect(Array.isArray(signalsConfig.signals)).toBe(true);
      expect(signalsConfig.signals.length).toBeGreaterThan(0);
    });

    it('should define embedding_similarity signal', () => {
      const embeddingSignal = signalsConfig.signals.find(
        s => s.name === 'embedding_similarity'
      );
      expect(embeddingSignal).toBeDefined();
      expect(embeddingSignal?.enabled).toBe(true);
    });

    it('should export candidateRules with phase and action', () => {
      expect(signalsConfig.candidateRules).toBeDefined();
      expect(Array.isArray(signalsConfig.candidateRules)).toBe(true);
      expect(signalsConfig.candidateRules.length).toBeGreaterThan(0);

      // All rules should have phase and action
      signalsConfig.candidateRules.forEach(rule => {
        expect(['extraction', 'resolution']).toContain(rule.phase);
        expect(['merge', 'link', 'canonical']).toContain(rule.action);
        expect(typeof rule.enabled).toBe('boolean');
      });
    });

    it('should have extraction-phase rules for same-document deduplication', () => {
      const extractionRules = getExtractionRules();
      expect(extractionRules.length).toBeGreaterThan(0);

      // All extraction rules should have action: 'merge'
      extractionRules.forEach(rule => {
        expect(rule.phase).toBe('extraction');
        expect(rule.action).toBe('merge');
      });

      // Should have same_doc_same_name rule
      const sameNameRule = extractionRules.find(r => r.name === 'same_doc_same_name');
      expect(sameNameRule).toBeDefined();
      expect(sameNameRule?.enabled).toBe(true);
    });

    it('should have resolution-phase rules for cross-document linking', () => {
      const resolutionRules = getResolutionRules();
      expect(resolutionRules.length).toBeGreaterThan(0);

      // All resolution rules should have action: 'link'
      resolutionRules.forEach(rule => {
        expect(rule.phase).toBe('resolution');
        expect(rule.action).toBe('link');
      });
    });

    it('should export aliasFilters with pronouns and genericTerms', () => {
      expect(signalsConfig.aliasFilters).toBeDefined();
      expect(Array.isArray(signalsConfig.aliasFilters.pronouns)).toBe(true);
      expect(signalsConfig.aliasFilters.pronouns.length).toBeGreaterThan(0);
      expect(Array.isArray(signalsConfig.aliasFilters.genericTerms)).toBe(true);
      expect(signalsConfig.aliasFilters.scope).toBe('cross-document');
    });

    it('should export candidateLimits with vector index setting', () => {
      expect(signalsConfig.candidateLimits).toBeDefined();
      expect(signalsConfig.candidateLimits.useVectorIndex).toBe(true);
    });
  });

  describe('resolution-policy.config', () => {
    it('should export resolutionPolicy with policyVersion', () => {
      expect(resolutionPolicy.policyVersion).toBeDefined();
      expect(typeof resolutionPolicy.policyVersion).toBe('string');
    });

    it('should define enabled edge types', () => {
      expect(resolutionPolicy.edges).toBeDefined();
      expect(Array.isArray(resolutionPolicy.edges)).toBe(true);
    });

    it('should define triple policies', () => {
      expect(resolutionPolicy.triples).toBeDefined();
      expect(Array.isArray(resolutionPolicy.triples)).toBe(true);
      expect(resolutionPolicy.triples.length).toBeGreaterThan(0);
    });

    it('should have worldKnowledgeAllowed flag in triples (no llmMode)', () => {
      resolutionPolicy.triples.forEach(triple => {
        expect(typeof triple.worldKnowledgeAllowed).toBe('boolean');
        expect((triple as any).llmMode).toBeUndefined(); // llmMode removed - unified prompt
      });
    });
  });

  describe('query-rules.config', () => {
    it('should export queryRules with profiles', () => {
      expect(queryRules.profiles).toBeDefined();
      expect(Array.isArray(queryRules.profiles)).toBe(true);
      expect(queryRules.profiles.length).toBeGreaterThan(0);
    });

    it('should define strict_identity_corpus_only profile', () => {
      const strictProfile = queryRules.profiles.find(
        p => p.name === 'strict_identity_corpus_only'
      );
      expect(strictProfile).toBeDefined();
      expect(strictProfile?.includeWorldKnowledgeEdges).toBe(false);
    });
  });

  describe('validateAllConfigs', () => {
    it('should validate without throwing', () => {
      expect(() => validateAllConfigs()).not.toThrow();
    });
  });
});
