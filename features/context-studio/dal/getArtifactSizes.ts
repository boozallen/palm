import logger from '@/server/logger';
import db from '@/server/db';

type SizeRow = { id: string; size: bigint | number | null };

/**
 * Byte size for a set of chat/workflow artifacts, keyed by artifact id. Computed
 * with octet_length rather than a stored column — neither ChatArtifact nor
 * WorkflowArtifact persists a size — so only ever call this for the ids on the
 * current page, same as getChatArtifactCosts/getWorkflowArtifactCosts.
 */
export default async function getArtifactSizes(
  chatArtifactIds: string[],
  workflowArtifactIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  try {
    const [chatRows, workflowRows] = await Promise.all([
      chatArtifactIds.length > 0
        ? db.$queryRaw<SizeRow[]>`
          SELECT id, COALESCE(octet_length("binaryContent"), octet_length(content), 0) AS size
          FROM "ChatArtifact"
          WHERE id = ANY(${chatArtifactIds}::uuid[])
        `
        : Promise.resolve([]),
      workflowArtifactIds.length > 0
        ? db.$queryRaw<SizeRow[]>`
          SELECT id, octet_length(content) AS size
          FROM "workflow_artifacts"
          WHERE id = ANY(${workflowArtifactIds}::uuid[])
        `
        : Promise.resolve([]),
    ]);

    for (const row of [...chatRows, ...workflowRows]) {
      result.set(row.id, Number(row.size ?? 0));
    }

    return result;
  } catch (error) {
    logger.error('Failed to fetch artifact sizes', error);
    throw new Error('Unable to fetch artifact sizes');
  }
}
