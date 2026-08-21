import {
  getApplicablePolicies,
  getEnabledEdgeTypes,
  getWorldKnowledgePolicy,
  validateEdgeTypeAllowed,
} from '@/features/graph-database/services/policyMatcher';

describe('policyMatcher', () => {
  describe('getApplicablePolicies', () => {
    it('should return enabled ENTITY-ENTITY policies', () => {
      const policies = getApplicablePolicies('ENTITY', 'ENTITY');
      
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.every(p => p.enabled)).toBe(true);
      expect(policies.every(p => p.from === 'ENTITY' && p.to === 'ENTITY')).toBe(true);
    });

    it('should return enabled CONCEPT-CONCEPT policies', () => {
      const policies = getApplicablePolicies('CONCEPT', 'CONCEPT');
      
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.every(p => p.enabled)).toBe(true);
      expect(policies.every(p => p.from === 'CONCEPT' && p.to === 'CONCEPT')).toBe(true);
    });

    it('should return enabled ENTITY-CONCEPT policies', () => {
      const policies = getApplicablePolicies('ENTITY', 'CONCEPT');
      
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.every(p => p.enabled)).toBe(true);
      expect(policies.every(p => p.from === 'ENTITY' && p.to === 'CONCEPT')).toBe(true);
    });

    it('should return enabled CONCEPT-ENTITY policies', () => {
      const policies = getApplicablePolicies('CONCEPT', 'ENTITY');
      
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.every(p => p.enabled)).toBe(true);
      expect(policies.every(p => p.from === 'CONCEPT' && p.to === 'ENTITY')).toBe(true);
    });

    it('should not return disabled policies', () => {
      // ENTITY-ENTITY SIMILAR is disabled by policy
      const policies = getApplicablePolicies('ENTITY', 'ENTITY');
      const similarPolicy = policies.find(p => p.edgeType === 'SIMILAR');
      
      // SIMILAR should not be in the list since it's disabled
      expect(similarPolicy).toBeUndefined();
    });
  });

  describe('getEnabledEdgeTypes', () => {
    it('should return IDENTITY and RELATED_RESOLUTION for ENTITY-ENTITY', () => {
      const edgeTypes = getEnabledEdgeTypes('ENTITY', 'ENTITY');
      
      expect(edgeTypes).toContain('IDENTITY');
      expect(edgeTypes).toContain('RELATED_RESOLUTION');
      expect(edgeTypes).not.toContain('SIMILAR'); // Disabled by policy
    });

    it('should return IDENTITY and SIMILAR for CONCEPT-CONCEPT', () => {
      const edgeTypes = getEnabledEdgeTypes('CONCEPT', 'CONCEPT');

      expect(edgeTypes).toContain('IDENTITY');
      expect(edgeTypes).toContain('SIMILAR');
      // RELATED_RESOLUTION is disabled for CONCEPT-CONCEPT in policy config
      expect(edgeTypes).not.toContain('RELATED_RESOLUTION');
    });

    it('should return RELATED_RESOLUTION for ENTITY-CONCEPT', () => {
      const edgeTypes = getEnabledEdgeTypes('ENTITY', 'CONCEPT');
      
      expect(edgeTypes).toContain('RELATED_RESOLUTION');
      expect(edgeTypes).not.toContain('IDENTITY'); // Not allowed for cross-category
      expect(edgeTypes).not.toContain('SIMILAR'); // Not allowed for cross-category
    });

    it('should return empty array if no policies enabled', () => {
      // DOCUMENT-DOCUMENT has no policies defined
      const edgeTypes = getEnabledEdgeTypes('DOCUMENT', 'DOCUMENT');
      
      expect(edgeTypes).toEqual([]);
    });
  });

  describe('getWorldKnowledgePolicy', () => {
    it('should return true for ENTITY-ENTITY (RELATED allows world knowledge)', () => {
      // ENTITY-ENTITY has IDENTITY (worldKnowledge=false) and RELATED (worldKnowledge=true)
      // Conservative approach: return true if ANY policy allows it
      const worldKnowledgeAllowed = getWorldKnowledgePolicy('ENTITY', 'ENTITY');
      
      expect(worldKnowledgeAllowed).toBe(true);
    });

    it('should return true for CONCEPT-CONCEPT (SIMILAR allows world knowledge)', () => {
      const worldKnowledgeAllowed = getWorldKnowledgePolicy('CONCEPT', 'CONCEPT');
      
      expect(worldKnowledgeAllowed).toBe(true);
    });

    it('should return true for ENTITY-CONCEPT (RELATED allows world knowledge)', () => {
      const worldKnowledgeAllowed = getWorldKnowledgePolicy('ENTITY', 'CONCEPT');
      
      expect(worldKnowledgeAllowed).toBe(true);
    });

    it('should return false if no policies allow world knowledge', () => {
      // If we filter to only policies that don't allow world knowledge
      // This test validates the conservative approach works correctly
      const worldKnowledgeAllowed = getWorldKnowledgePolicy('DOCUMENT', 'DOCUMENT');
      
      expect(worldKnowledgeAllowed).toBe(false);
    });
  });

  describe('validateEdgeTypeAllowed', () => {
    it('should allow IDENTITY for ENTITY-ENTITY', () => {
      const isAllowed = validateEdgeTypeAllowed('IDENTITY', 'ENTITY', 'ENTITY');
      
      expect(isAllowed).toBe(true);
    });

    it('should allow RELATED_RESOLUTION for ENTITY-ENTITY', () => {
      const isAllowed = validateEdgeTypeAllowed('RELATED_RESOLUTION', 'ENTITY', 'ENTITY');
      
      expect(isAllowed).toBe(true);
    });

    it('should NOT allow SIMILAR for ENTITY-ENTITY', () => {
      const isAllowed = validateEdgeTypeAllowed('SIMILAR', 'ENTITY', 'ENTITY');
      
      expect(isAllowed).toBe(false);
    });

    it('should allow IDENTITY for CONCEPT-CONCEPT', () => {
      const isAllowed = validateEdgeTypeAllowed('IDENTITY', 'CONCEPT', 'CONCEPT');
      
      expect(isAllowed).toBe(true);
    });

    it('should allow SIMILAR for CONCEPT-CONCEPT', () => {
      const isAllowed = validateEdgeTypeAllowed('SIMILAR', 'CONCEPT', 'CONCEPT');
      
      expect(isAllowed).toBe(true);
    });

    it('should allow RELATED_RESOLUTION for ENTITY-CONCEPT', () => {
      const isAllowed = validateEdgeTypeAllowed('RELATED_RESOLUTION', 'ENTITY', 'CONCEPT');
      
      expect(isAllowed).toBe(true);
    });

    it('should NOT allow IDENTITY for ENTITY-CONCEPT (cross-category)', () => {
      const isAllowed = validateEdgeTypeAllowed('IDENTITY', 'ENTITY', 'CONCEPT');
      
      expect(isAllowed).toBe(false);
    });

    it('should NOT allow SIMILAR for ENTITY-CONCEPT (cross-category)', () => {
      const isAllowed = validateEdgeTypeAllowed('SIMILAR', 'ENTITY', 'CONCEPT');
      
      expect(isAllowed).toBe(false);
    });
  });
});
