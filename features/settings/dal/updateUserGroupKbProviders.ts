import db from '@/server/db';
import logger from '@/server/logger';
import { KbProvider, kbProviderConfigSchema } from '@/features/shared/types';

type UpdateUserGroupKbProvidersInput = {
  userGroupId: string;
  kbProviderId: string;
  enabled: boolean;
};

export default async function updateUserGroupKbProviders(
  input: UpdateUserGroupKbProvidersInput
): Promise<KbProvider[]> {
  return db.$transaction(async (prisma) => {
    let updatedUserGroupKbProviders;

    const connectToKbProvider = {
      connect: {
        id: input.kbProviderId,
      },
    };

    const disconnectFromKbProvider = {
      disconnect: {
        id: input.kbProviderId,
      },
    };

    try {
      updatedUserGroupKbProviders = await prisma.userGroup.update({
        where: {
          id: input.userGroupId,
        },
        data: {
          kbProviders: input.enabled
            ? connectToKbProvider
            : disconnectFromKbProvider,
        },
        select: {
          kbProviders: {
            where: { deletedAt: null },
          },
        },
      });
    } catch (error) {
      logger.error('Error updating the user group\'s KbProviders', error);
      throw new Error('Error updating the user group\'s KbProviders');
    }

    return updatedUserGroupKbProviders.kbProviders.map((kbProvider) => {
      try {
        return {
          id: kbProvider.id,
          label: kbProvider.label,
          config: kbProviderConfigSchema.parse(kbProvider.config),
          kbProviderType: kbProvider.kbProviderType,
          writeAccess: kbProvider.writeAccess,
          createdAt: kbProvider.createdAt,
          updatedAt: kbProvider.updatedAt,
        };
      } catch (error) {
        logger.error(
          'User group knowledge base providers config is invalid',
          error
        );
        throw new Error('Error updating the user group\'s KbProviders');
      }
    });
  });
}
