import crypto from 'crypto';
import db from '@/server/db';
import logger from '@/server/logger';
import { sanitizeForPostgres } from '@/features/workflows/utils/sanitize';
import { PrimitiveConfig } from '@/features/workflows/types/primitive';

export type CreateWorkflowParams = {
  userId: string;
  name: string;
  description?: string;
  primitives: PrimitiveConfig[];
  viewport?: { x: number; y: number; zoom: number };
  userGroupIds?: string[];
  pinnedUserGroupId?: string;
};

export default async function createWorkflow({
  userId,
  name,
  description,
  primitives,
  viewport,
  userGroupIds,
  pinnedUserGroupId,
}: CreateWorkflowParams) {
  try {
    const definition = {
      id: crypto.randomUUID(),
      name,
      description,
      version: '1.0.0',
      primitives,
      ...(viewport && { viewport }),
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await db.workflow.create({
      data: {
        name,
        description,
        version: '1.0.0',
        definition: sanitizeForPostgres(definition) as any,
        createdBy: userId,
        pinnedUserGroupId,
        ...(userGroupIds && {
          userGroups: {
            connect: userGroupIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        userGroups: true,
      },
    });
  } catch (error) {
    logger.error('Error creating workflow:', error);
    throw new Error('Error creating workflow');
  }
}
