import { z } from 'zod';

export const entitySchema = z
  .object({
    id: z.string().min(1),
    label: z.enum(['Entity', 'Concept']),
    type: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    properties: z.record(z.any()).optional(),
  })
  .strict();

export const relationSchema = z
  .object({
    source: z.string().min(1),
    target: z.string().min(1),
    type: z.string().min(1),
    properties: z.record(z.any()).optional(),
  })
  .strict();

export const corporateStructureRowSchema = z
  .object({
    company_entity_id: z.string().min(1),
    parent_or_controlling_entity: z.string().nullable().optional(),
    normalized_corporate_status: z.string().nullable().optional(),
    ownership_notes: z.array(z.string()).nullable().optional(),
    partner_program_signal: z.string().nullable().optional(),
    named_channel_signal: z.string().nullable().optional(),
  })
  .passthrough();

export const partneringMatchHitSchema = z
  .object({
    company_entity_id: z.string().min(1),
    partnering_posture_id: z.string().min(1),
    match_hits: z.array(z.string()),
  })
  .passthrough();

export const palmGraphSchema = z
  .object({
    metadata: z.object({}).passthrough().optional(),
    entities: z.array(entitySchema).min(1),
    relations: z.array(relationSchema),
    supplementary: z
      .object({
        corporate_structure: z.array(corporateStructureRowSchema).optional(),
        partnering_match_hits: z.array(partneringMatchHitSchema).optional(),
      })
      .optional(),
  })
  .passthrough();

export type PalmGraph = z.infer<typeof palmGraphSchema>;
export type ValidEntity = z.infer<typeof entitySchema>;
export type ValidRelation = z.infer<typeof relationSchema>;
export type CorporateStructureRow = z.infer<typeof corporateStructureRowSchema>;
export type PartneringMatchHitRow = z.infer<typeof partneringMatchHitSchema>;

export interface NodeSpec {
  id: string;
  label: 'Entity' | 'Concept';
  name: string;
  normalizedName: string;
  type: string;
  description: string;
  properties: Record<string, unknown>;
}

export interface InternalEntity extends Omit<ValidEntity, 'id'> {
  id: string;          // UUID
  externalId: string;  // original semantic id from the source palm-graph
}

export interface EdgeSpec {
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface IngestResult {
  entityCount: number;
  conceptCount: number;
  edgeCount: number;
  embeddingCount: number;
  embeddingSkippedCount: number;
  documentCount: number;
}
