import {
  compileSchema,
  RESERVED_NODE_KEYS,
  RESERVED_EDGE_KEYS,
} from '@/features/graph-database/services/compileSchema';
import { general } from '@/features/graph-database/config/schemas/general.schema';
import { governmentPursuit } from '@/features/graph-database/config/schemas/government-pursuit.schema';

const entityTypeEnum = (tool: { inputSchema: Record<string, unknown> }): string[] =>
  (tool.inputSchema as any).properties.entities.items.properties.type.enum;
const conceptCategoryEnum = (tool: { inputSchema: Record<string, unknown> }): string[] =>
  (tool.inputSchema as any).properties.concepts.items.properties.category.enum;
const relationTypeEnum = (tool: { inputSchema: Record<string, unknown> }): string[] =>
  (tool.inputSchema as any).properties.relationships.items.properties.relationType.enum;

describe('compileSchema', () => {
  describe('general schema parity', () => {
    const { systemPrompt, tool, zodSchema } = compileSchema(general);

    it('emits the legacy entity types in the tool input schema', () => {
      expect(entityTypeEnum(tool)).toEqual(
        expect.arrayContaining(['PERSON', 'ORGANIZATION', 'LOCATION', 'TECHNOLOGY', 'PRODUCT', 'DATE', 'DOCUMENT'])
      );
    });

    it('emits the legacy concept categories', () => {
      expect(conceptCategoryEnum(tool)).toEqual(['TECHNICAL', 'BUSINESS', 'DOMAIN_SPECIFIC', 'GENERAL']);
    });

    it('emits the legacy relationship types', () => {
      expect(relationTypeEnum(tool)).toEqual(
        expect.arrayContaining(['WORKS_FOR', 'PART_OF', 'REQUIRES', 'IMPLEMENTS', 'USES', 'SUCCEEDED_BY'])
      );
    });

    it('names the forced tool extract_graph', () => {
      expect(tool.name).toBe('extract_graph');
    });

    it('produces a zod schema (general defines no custom node properties)', () => {
      const parsed = zodSchema.safeParse({ entities: [], concepts: [], relationships: [], summary: '' });
      expect(parsed.success).toBe(true);
    });
  });

  describe('government-pursuit shape', () => {
    const { tool } = compileSchema(governmentPursuit);

    it('includes custom node types', () => {
      expect(entityTypeEnum(tool)).toEqual(
        expect.arrayContaining(['Opportunity', 'Agency', 'Role', 'PerformanceStandard', 'Requirement'])
      );
    });

    it('includes custom edge types', () => {
      expect(relationTypeEnum(tool)).toEqual(
        expect.arrayContaining(['ISSUED_BY', 'MEASURED_BY', 'REQUIRES_ROLE', 'CONSTRAINED_BY'])
      );
    });

    it('encodes per-type node property keys in the tool input schema', () => {
      const serialized = JSON.stringify(tool.inputSchema);
      expect(serialized).toContain('solicitationNumber');
      expect(serialized).toContain('dueDate');
      expect(serialized).toContain('laborCategory');
    });

    it('encodes per-type edge property keys in the tool input schema', () => {
      const serialized = JSON.stringify(tool.inputSchema);
      expect(serialized).toContain('importance');
      expect(serialized).toContain('rationale');
    });
  });

  describe('cache-prefix invariant', () => {
    it('is a pure function of the schema (deterministic across calls)', () => {
      const a = compileSchema(governmentPursuit);
      const b = compileSchema(governmentPursuit);
      expect(a.systemPrompt).toEqual(b.systemPrompt);
      expect(JSON.stringify(a.tool)).toEqual(JSON.stringify(b.tool));
    });

    it('does not embed chunk text or a {TEXT} placeholder in the system prompt or tool', () => {
      const { systemPrompt, tool } = compileSchema(general);
      expect(systemPrompt).not.toContain('{TEXT}');
      expect(systemPrompt).not.toContain('Text to analyze');
      expect(JSON.stringify(tool)).not.toContain('{TEXT}');
    });
  });

  describe('zod validation', () => {
    const { zodSchema } = compileSchema(governmentPursuit);

    it('accepts a valid tool input', () => {
      const result = zodSchema.safeParse({
        entities: [
          {
            text: 'Program Manager',
            type: 'Role',
            description: 'Key personnel role',
            aliases: ['PM'],
            context: 'The Contractor shall provide a Program Manager',
            confidence: 0.9,
            properties: { laborCategory: 'Program Manager' },
          },
        ],
        concepts: [],
        relationships: [],
        summary: 'summary',
      });
      expect(result.success).toBe(true);
    });

    it('rejects a malformed tool input (entity missing required text)', () => {
      const result = zodSchema.safeParse({
        entities: [{ type: 'Opportunity' }],
        concepts: [],
        relationships: [],
        summary: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('reserved key sets', () => {
    it('protects infra node fields', () => {
      ['id', 'name', 'type', 'documentId', 'userId'].forEach((key) => {
        expect(RESERVED_NODE_KEYS.has(key)).toBe(true);
      });
    });

    it('protects infra edge fields', () => {
      ['id', 'relationType', 'documentId', 'chunkId', 'confidence'].forEach((key) => {
        expect(RESERVED_EDGE_KEYS.has(key)).toBe(true);
      });
    });
  });
});
