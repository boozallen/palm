import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { Forbidden, NotFound } from '@/features/shared/errors/routeErrors';
import getWorkflowFromDb from '@/features/workflows/dal/getWorkflow';
import getUserWorkflowsAccess from '@/features/shared/dal/getUserWorkflowsAccess';

export const getWorkflow = procedure
  .input(
    z.object({
      workflowId: z.string().uuid(),
    })
  )
  .query(async ({ ctx, input }) => {
    const hasAccess = await getUserWorkflowsAccess(ctx.userId);
    if (!hasAccess) {
      throw Forbidden('You do not have access to workflows');
    }

    const workflow = await getWorkflowFromDb(input.workflowId, ctx.userId);

    if (!workflow || workflow.deletedAt) {
      throw NotFound('Workflow not found');
    }

    const isCreator = workflow.createdBy === ctx.userId;
    const hasGroupAccess = workflow.userGroups.some(
      (group: { userGroupMemberships: unknown[] }) => group.userGroupMemberships.length > 0
    );

    if (!isCreator && !hasGroupAccess) {
      throw Forbidden('You do not have permission to view this workflow');
    }

    const definition = workflow.definition as any;

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      definition,
      creator: workflow.creator,
      userGroups: workflow.userGroups.map((group: { id: string; label: string }) => ({
        id: group.id,
        label: group.label,
      })),
      pinnedUserGroupId: workflow.pinnedUserGroupId,
      pinnedUserGroup: workflow.pinnedUserGroup
        ? {
          id: workflow.pinnedUserGroup.id,
          label: workflow.pinnedUserGroup.label,
          aiProviderIds: workflow.pinnedUserGroup.aiProviders.map((provider: { id: string }) => provider.id),
        }
        : null,
      recentExecutions: workflow.executions,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    };
  });
