import db from '@/server/db';
import logger from '@/server/logger';
import { Provider } from '@/features/shared/types';
import buildProvider from '@/features/shared/dal/buildProvider';

type UpdateUserGroupAiProvidersInput = {
  userGroupId: string;
  aiProviderId: string;
  enabled: boolean;
};

export default async function updateUserGroupAiProviders(input: UpdateUserGroupAiProvidersInput):
  Promise<Provider[]> {

  const connectToAiProvider = {
    connect: {
      id: input.aiProviderId,
    },
  };
  const disconnectFromAiProvider = {
    disconnect: {
      id: input.aiProviderId,
    },
  };

  try {
    const updatedUserGroup = await db.userGroup.update({
      where: {
        id: input.userGroupId,
      },
      data: {
        aiProviders: input.enabled ? connectToAiProvider : disconnectFromAiProvider,
      },
      select: {
        aiProviders: true,
      },
    });

    const providers: Provider[] = [];

    for (const aiProvider of updatedUserGroup.aiProviders) {
      const provider = await buildProvider(db, aiProvider);
      providers.push(provider);
    }

    return providers;
  } catch (error) {
    logger.error('Error updating the user group\'s AiProviders', error);
    throw new Error('Error updating the user group\'s AiProviders');
  }
};
