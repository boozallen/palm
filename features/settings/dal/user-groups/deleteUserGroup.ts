import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

/**
 * Soft-deletes a user group so AiProviderUsage rows keep their real attribution instead
 * of being nulled out by a hard delete's SetNull cascade. Every other relation that would
 * otherwise cascade or clear on a hard delete is cleaned up manually here, since a soft
 * delete never fires the schema's onDelete actions.
 * @param {string} id
 */
export default async function deleteUserGroup(id: string):
  Promise<{ id: string }> {

  try {
    const deletedUserGroup = await db.$transaction(async (tx) => {
      await Promise.all([
        tx.userGroupMembership.deleteMany({ where: { userGroupId: id } }),
        tx.adminDocumentGroup.deleteMany({ where: { userGroupId: id } }),
        tx.systemConfig.updateMany({
          where: { defaultUserGroupId: id },
          data: { defaultUserGroupId: null },
        }),
        tx.chat.updateMany({ where: { userGroupId: id }, data: { userGroupId: null } }),
        tx.agentPrismJob.updateMany({ where: { userGroupId: id }, data: { userGroupId: null } }),
        tx.agentOdramJob.updateMany({ where: { userGroupId: id }, data: { userGroupId: null } }),
        tx.agentPulseJob.updateMany({ where: { userGroupId: id }, data: { userGroupId: null } }),
        tx.rateCard.updateMany({ where: { userGroupId: id }, data: { userGroupId: null } }),
        tx.workflow.updateMany({ where: { pinnedUserGroupId: id }, data: { pinnedUserGroupId: null } }),
        tx.workflowExecution.updateMany({ where: { userGroupId: id }, data: { userGroupId: null } }),
      ]);
      return tx.userGroup.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          joinCode: null,
          agentProviders: { set: [] },
          aiAgents: { set: [] },
          aiProviders: { set: [] },
          githubProviders: { set: [] },
          kbProviders: { set: [] },
          workflows: { set: [] },
          artifactTemplates: { set: [] },
        },
      });
    });

    return { id: deletedUserGroup.id };

  } catch (error) {
    logger.error('Error deleting user group', error);
    throw new Error(handlePrismaError(error));
  }
};
