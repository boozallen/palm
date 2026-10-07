import crypto from 'crypto';
import db from '@/server/db';
import logger from '@/server/logger';

export type CreateWorkflowArtifactParams = {
  fileExtension: string;
  label: string;
  content: string;
  workflowExecutionId: string;
  primitiveId: string;
};

export default async function createWorkflowArtifact({
  fileExtension,
  label,
  content,
  workflowExecutionId,
  primitiveId,
}: CreateWorkflowArtifactParams) {
  try {
    return await db.workflowArtifact.create({
      data: {
        id: crypto.randomUUID(),
        fileExtension,
        label,
        content,
        workflowExecutionId,
        primitiveId,
      },
    });
  } catch (error) {
    logger.error('Error creating workflow artifact:', error);
    throw new Error('Error creating workflow artifact');
  }
}
