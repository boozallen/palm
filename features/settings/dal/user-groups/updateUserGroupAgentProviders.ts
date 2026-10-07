import db from '@/server/db';
import logger from '@/server/logger';

type UpdateUserGroupAgentProvidersInput = {
  userGroupId: string;
  agentProviderId: string;
  enabled: boolean;
};

type AgentProviderListItem = {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function updateUserGroupAgentProviders(
  input: UpdateUserGroupAgentProvidersInput,
): Promise<AgentProviderListItem[]> {
  const { userGroupId, agentProviderId, enabled } = input;

  try {
    const updatedGroup = await db.userGroup.update({
      where: { id: userGroupId, deletedAt: null },
      data: {
        agentProviders: {
          [enabled ? 'connect' : 'disconnect']: { id: agentProviderId },
        },
      },
      include: {
        agentProviders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return updatedGroup.agentProviders.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  } catch (error) {
    logger.error('Error updating user group agent providers', error);
    throw new Error('Error updating user group agent providers');
  }
}
