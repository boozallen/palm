import { BadRequest } from '@/features/shared/errors/routeErrors';
import type { PalmGraph } from '@/features/graph-database/services/jsonIngest/types';

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAMPLE_CAP = 5;

function formatSample(values: string[]): string {
  const sample = values.slice(0, SAMPLE_CAP).join(', ');
  if (values.length <= SAMPLE_CAP) {
    return sample;
  }
  return `${sample} (and ${values.length - SAMPLE_CAP} more, total ${values.length})`;
}

export function validateReferentialIntegrity(palmGraph: PalmGraph): void {
  const { entities, relations, supplementary } = palmGraph;

  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];
  for (const entity of entities) {
    if (seenIds.has(entity.id)) {
      duplicateIds.push(entity.id);
    } else {
      seenIds.add(entity.id);
    }
  }
  if (duplicateIds.length > 0) {
    throw BadRequest(
      `Duplicate entity ids: ${formatSample(duplicateIds)}`
    );
  }

  const missingSources: string[] = [];
  const missingTargets: string[] = [];
  const badRelationTypes: string[] = [];
  for (const relation of relations) {
    if (!seenIds.has(relation.source)) {
      missingSources.push(relation.source);
    }
    if (!seenIds.has(relation.target)) {
      missingTargets.push(relation.target);
    }
    if (!SAFE_IDENTIFIER.test(relation.type)) {
      badRelationTypes.push(relation.type);
    }
  }

  if (missingSources.length > 0) {
    throw BadRequest(
      `Relation sources not present in entities: ${formatSample(missingSources)}`
    );
  }
  if (missingTargets.length > 0) {
    throw BadRequest(
      `Relation targets not present in entities: ${formatSample(missingTargets)}`
    );
  }
  if (badRelationTypes.length > 0) {
    throw BadRequest(
      `Relation types must match /^[A-Za-z_][A-Za-z0-9_]*$/: ${formatSample(badRelationTypes)}`
    );
  }

  const badPropertyKeys: string[] = [];
  const collectBadPropertyKeys = (props: Record<string, unknown> | undefined): void => {
    if (!props) {
      return;
    }
    for (const key of Object.keys(props)) {
      if (!SAFE_IDENTIFIER.test(key)) {
        badPropertyKeys.push(key);
      }
    }
  };
  for (const entity of entities) {
    collectBadPropertyKeys(entity.properties);
  }
  for (const relation of relations) {
    collectBadPropertyKeys(relation.properties);
  }
  if (badPropertyKeys.length > 0) {
    throw BadRequest(
      `Property keys must match /^[A-Za-z_][A-Za-z0-9_]*$/: ${formatSample(badPropertyKeys)}`
    );
  }

  if (supplementary?.corporate_structure) {
    const missing: string[] = [];
    for (const row of supplementary.corporate_structure) {
      if (!seenIds.has(row.company_entity_id)) {
        missing.push(row.company_entity_id);
      }
    }
    if (missing.length > 0) {
      throw BadRequest(
        `supplementary.corporate_structure references unknown entity ids: ${formatSample(missing)}`
      );
    }
  }

  if (supplementary?.partnering_match_hits) {
    const missing: string[] = [];
    for (const row of supplementary.partnering_match_hits) {
      if (!seenIds.has(row.company_entity_id)) {
        missing.push(row.company_entity_id);
      }
    }
    if (missing.length > 0) {
      throw BadRequest(
        `supplementary.partnering_match_hits references unknown entity ids: ${formatSample(missing)}`
      );
    }
  }
}
