import db from '@/server/db';
import logger from '@/server/logger';
import {
  IncomingSharedWorkflow,
  OutgoingSharedWorkflow,
  GetSharedWorkflowsResult,
} from '@/features/workflows/types/shared-workflow';
import { getSharedWorkflowExpirationDate } from '@/features/shared/utils/dateUtils';

type GetSharedWorkflowsInput = {
  userId: string;
  userGroupIds: string[];
};

export default async function getSharedWorkflows(
  input: GetSharedWorkflowsInput
): Promise<GetSharedWorkflowsResult> {
  const { userId, userGroupIds } = input;

  try {
    const expirationDate = getSharedWorkflowExpirationDate();

    const incomingSharesPromise =
      userGroupIds.length > 0
        ? db.sharedWorkflow.findMany({
            where: {
              sharedWithUserGroupIds: {
                hasSome: userGroupIds,
              },
              deletedAt: null,
              createdAt: {
                gt: expirationDate,
              },
              sourceUserId: {
                not: userId,
              },
              actions: {
                none: {
                  userId: userId,
                },
              },
            },
            include: {
              sourceWorkflow: true,
              sourceUser: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : Promise.resolve([]);

    const outgoingSharesPromise = db.sharedWorkflow.findMany({
      where: {
        sourceUserId: userId,
        deletedAt: null,
        createdAt: {
          gt: expirationDate,
        },
      },
      include: {
        sourceWorkflow: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const [incomingSharesResults, outgoingSharesResults] = await Promise.all([
      incomingSharesPromise,
      outgoingSharesPromise,
    ]);

    const incomingShares: IncomingSharedWorkflow[] = incomingSharesResults.map(
      (result) => ({
        id: result.id,
        sourceWorkflowId: result.sourceWorkflowId,
        sourceUserId: result.sourceUserId,
        sourceWorkflowName: result.sourceWorkflow.name,
        sharedByUsername: result.sourceUser.name,
        createdAt: result.createdAt,
      })
    );

    const outgoingShares: OutgoingSharedWorkflow[] = outgoingSharesResults.map(
      (result) => ({
        id: result.id,
        workflowId: result.sourceWorkflowId,
        workflowName: result.sourceWorkflow.name,
        sharedWithUserGroupIds: result.sharedWithUserGroupIds,
        createdAt: result.createdAt,
      })
    );

    return {
      incoming: incomingShares,
      outgoing: outgoingShares,
    };
  } catch (error) {
    logger.error('Error getting shared workflows', error);
    throw new Error('Error getting shared workflows');
  }
}
