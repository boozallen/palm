import * as promptModule from '@/features/graph-database/services/resolutionPrompt';
import type { Entity, SignalVector } from '@/features/graph-database/types';
import { EntityType } from '@/features/graph-database/types';

describe('resolutionPrompt', () => {
  // Note: context is now on MENTIONS edge, not on Entity node
  const mockEntity1: Entity = {
    id: '1',
    name: 'DHA',
    normalizedName: 'dha',
    type: EntityType.ORGANIZATION,
    description: 'Defense Health Agency',
    aliases: ['Defense Health Agency', 'DHA'],
    documentId: 'doc1',
    mentionCount: 5,
    firstSeenAt: new Date('2025-01-01'),
  };

  const mockEntity2: Entity = {
    id: '2',
    name: 'Defense Health Agency',
    normalizedName: 'defense health agency',
    type: EntityType.ORGANIZATION,
    description: 'US military healthcare organization',
    aliases: ['DHA'],
    documentId: 'doc1',
    mentionCount: 3,
    firstSeenAt: new Date('2025-01-02'),
  };

  const mockSignals: SignalVector = {
    embedding_similarity: 0.92,
    has_name_alias_overlap: true,
    same_name: false,
    same_type: true,
    same_document: true,
    sharedNames: ['DHA', 'dha'],
  };

  describe('formatNodeContext', () => {
    it('should format entity context correctly', () => {
      const formattedContext = promptModule.formatNodeContext(mockEntity1);

      expect(formattedContext).toContain('DHA');
      expect(formattedContext).toContain('Defense Health Agency'); // From description
      expect(formattedContext).toContain('ORGANIZATION');
      // Note: context is now on MENTIONS edge, not formatted in entity prompt
    });
  });

  describe('getEdgeTypeDefinitions', () => {
    it('should return definitions for allowed edge types', () => {
      const defs = promptModule.getEdgeTypeDefinitions(['IDENTITY', 'SIMILAR'], false, true);

      expect(defs).toContain('IDENTITY');
      expect(defs).toContain('SIMILAR');
      expect(defs).not.toContain('RELATED_RESOLUTION');
    });

    it('should handle all edge types', () => {
      const defs = promptModule.getEdgeTypeDefinitions(['IDENTITY', 'SIMILAR', 'RELATED_RESOLUTION'], false, true);

      expect(defs).toContain('IDENTITY');
      expect(defs).toContain('SIMILAR');
      expect(defs).toContain('RELATED_RESOLUTION');
    });
  });

  describe('getWorldKnowledgeInstructions', () => {
    it('should allow world knowledge when true', () => {
      const instr = promptModule.getWorldKnowledgeInstructions(true);
      expect(instr).toContain('MAY use your knowledge');
    });

    it('should restrict to corpus when false', () => {
      const instr = promptModule.getWorldKnowledgeInstructions(false);
      expect(instr).toContain('Use ONLY the information provided');
      expect(instr).toContain('Do NOT use external knowledge');
    });
  });

  describe('buildUnifiedPrompt', () => {
    it('should build complete prompt with all components', () => {
      const prompt = promptModule.buildUnifiedPrompt(mockEntity1, mockEntity2, {
        allowedEdgeTypes: ['IDENTITY', 'SIMILAR'],
        worldKnowledgeAllowed: false,
        signals: mockSignals,
      });

      // Should include entity details
      expect(prompt).toContain('DHA');
      expect(prompt).toContain('Defense Health Agency');

      // Should include signals
      expect(prompt).toContain('92.0%'); // embedding_similarity
      expect(prompt).toContain('Same main name: NO');
      expect(prompt).toContain('Same entity type: YES');
      expect(prompt).toContain('Same document: YES');
      expect(prompt).toContain('Name/alias overlap: YES');

      // Should include edge type definitions
      expect(prompt).toContain('IDENTITY');
      expect(prompt).toContain('SIMILAR');
      expect(prompt).toContain('UNRELATED');

      // Should include world knowledge constraint
      expect(prompt).toContain('Use ONLY the information provided');

      // Should include JSON response format
      expect(prompt).toContain('"decision"');
      expect(prompt).toContain('"confidence"');
      expect(prompt).toContain('"rationale"');
    });

    it('should adapt to different allowed edge types', () => {
      const prompt = promptModule.buildUnifiedPrompt(mockEntity1, mockEntity2, {
        allowedEdgeTypes: ['RELATED_RESOLUTION'],
        worldKnowledgeAllowed: true,
        signals: mockSignals,
      });

      // Check that RELATED_RESOLUTION definition appears
      expect(prompt).toContain('RELATED_RESOLUTION: These have a meaningful business relationship');

      // Check that IDENTITY and SIMILAR definitions don't appear
      // (Note: Words may still appear in JSON schema example)
      expect(prompt).not.toContain('IDENTITY: These refer to the SAME real-world entity');
      expect(prompt).not.toContain('SIMILAR: These are RELATED but DISTINCT entities');

      expect(prompt).toContain('MAY use your knowledge');
    });
  });

  describe('parseResolutionResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        decision: 'IDENTITY',
        confidence: 0.95,
        rationale: 'Both refer to the same organization, Defense Health Agency',
      });

      const parsed = promptModule.parseResolutionResponse(response);

      expect(parsed.decision).toBe('IDENTITY');
      expect(parsed.confidence).toBe(0.95);
      expect(parsed.rationale).toContain('same organization');
    });

    it('should extract JSON from text with extra content', () => {
      const response = `Here is my analysis:

      {"decision": "SIMILAR", "confidence": 0.8, "rationale": "Related but distinct"}

      Hope this helps!`;

      const parsed = promptModule.parseResolutionResponse(response);

      expect(parsed.decision).toBe('SIMILAR');
      expect(parsed.confidence).toBe(0.8);
    });

    it('should throw error for missing fields', () => {
      const response = JSON.stringify({ decision: 'IDENTITY' }); // Missing confidence, rationale

      expect(() => promptModule.parseResolutionResponse(response)).toThrow('Missing required fields');
    });

    it('should throw error for invalid decision', () => {
      const response = JSON.stringify({
        decision: 'INVALID_EDGE',
        confidence: 0.9,
        rationale: 'Test',
      });

      expect(() => promptModule.parseResolutionResponse(response)).toThrow('Invalid decision');
    });

    it('should throw error for invalid confidence', () => {
      const response = JSON.stringify({
        decision: 'IDENTITY',
        confidence: 1.5, // Out of range
        rationale: 'Test',
      });

      expect(() => promptModule.parseResolutionResponse(response)).toThrow('Invalid confidence');
    });

    it('should accept UNRELATED as valid decision', () => {
      const response = JSON.stringify({
        decision: 'UNRELATED',
        confidence: 0.9,
        rationale: 'These are completely different entities',
      });

      const parsed = promptModule.parseResolutionResponse(response);
      expect(parsed.decision).toBe('UNRELATED');
    });
  });
});
