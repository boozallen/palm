import slugify from 'slugify';
import type { Logger } from '@/server/logger';
import type {
  ValidEntity,
  ValidRelation,
  CorporateStructureRow,
  PartneringMatchHitRow,
  EdgeSpec,
} from '@/features/graph-database/services/jsonIngest/types';

const CORPORATE_STRUCTURE_FIELDS: ReadonlyArray<keyof CorporateStructureRow> = [
  'parent_or_controlling_entity',
  'normalized_corporate_status',
  'ownership_notes',
  'partner_program_signal',
  'named_channel_signal',
];

function slugForParentId(parentName: string): string {
  const slug = slugify(parentName, { lower: true, strict: true });
  return `parent:${slug}`;
}

export function mergeCorporateStructure(
  entities: ValidEntity[],
  rows: CorporateStructureRow[] | undefined
): { entities: ValidEntity[]; parentEdges: EdgeSpec[] } {
  if (!rows || rows.length === 0) {
    return { entities: [...entities], parentEdges: [] };
  }

  const rowsByCompanyId = new Map<string, CorporateStructureRow>();
  for (const row of rows) {
    rowsByCompanyId.set(row.company_entity_id, row);
  }

  const nextEntities: ValidEntity[] = entities.map((entity) => {
    const row = rowsByCompanyId.get(entity.id);
    if (!row) {
      return entity;
    }
    const extraProps: Record<string, unknown> = {};
    for (const field of CORPORATE_STRUCTURE_FIELDS) {
      const value = row[field];
      if (value !== undefined && value !== null) {
        extraProps[field] = value;
      }
    }
    return {
      ...entity,
      properties: {
        ...(entity.properties ?? {}),
        ...extraProps,
      },
    };
  });

  const parentEntitiesById = new Map<string, ValidEntity>();
  const parentEdges: EdgeSpec[] = [];

  for (const row of rows) {
    const parentName = row.parent_or_controlling_entity;
    if (!parentName || typeof parentName !== 'string' || parentName.trim().length === 0) {
      continue;
    }
    const parentId = slugForParentId(parentName);
    if (!parentEntitiesById.has(parentId)) {
      parentEntitiesById.set(parentId, {
        id: parentId,
        label: 'Entity',
        type: 'parent_company',
        name: parentName,
        properties: {},
      });
    }
    parentEdges.push({
      source: row.company_entity_id,
      target: parentId,
      type: 'CONTROLLED_BY',
      properties: {},
    });
  }

  return {
    entities: [...nextEntities, ...parentEntitiesById.values()],
    parentEdges,
  };
}

export function mergePartneringMatchHits(
  relations: ValidRelation[],
  hits: PartneringMatchHitRow[] | undefined,
  logger: Logger
): ValidRelation[] {
  if (!hits || hits.length === 0) {
    return [...relations];
  }

  const next: ValidRelation[] = relations.map((relation) => ({
    ...relation,
    properties: relation.properties ? { ...relation.properties } : undefined,
  }));

  for (const hit of hits) {
    const targetIndex = next.findIndex(
      (rel) =>
        rel.source === hit.company_entity_id
        && rel.target === hit.partnering_posture_id
        && rel.type === 'HAS_PARTNERING_POSTURE'
    );
    if (targetIndex === -1) {
      logger.warn('[JSON-INGEST] partnering_match_hits target edge not found', {
        companyEntityId: hit.company_entity_id,
        partneringPostureId: hit.partnering_posture_id,
      });
      continue;
    }
    const current = next[targetIndex];
    next[targetIndex] = {
      ...current,
      properties: {
        ...(current.properties ?? {}),
        match_hits: hit.match_hits,
      },
    };
  }

  return next;
}
