import { KbProviderType } from '@/features/shared/types';
import { procedure } from '@/server/trpc';
import { z } from 'zod';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getKbProvider from '@/features/settings/dal/getKbProvider';
import sanitizeKbProviderConfig from '@/features/settings/utils/sanitizeKbProviderConfig';

const inputSchema = z.object({
  id: z.string().uuid(),
});

const outputSchema = z.object({
  kbProvider: z.object({
    id: z.string().uuid(),
    label: z.string(),
    kbProviderType: z.nativeEnum(KbProviderType),
    config: z.union([
      z.object({
        apiEndpoint: z.string(),
      }),
      z.object({
        region: z.string(),
      }),
    ]),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input, ctx }) => {
    // check if user has permission to get KB provider
    if (ctx.userRole !== UserRole.Admin) {
      logger.warn('Unauthorized user trpc.profile.getKbProvider', {
        userId: ctx.userId,
      });
      throw Forbidden('You do not have permission to access this resource');
    }

    const kbProvider = await getKbProvider(input.id);

    const sanitizedConfig = sanitizeKbProviderConfig(kbProvider.config);

    const output: z.infer<typeof outputSchema> = {
      kbProvider: {
        id: kbProvider.id,
        label: kbProvider.label,
        kbProviderType: kbProvider.kbProviderType,
        config: sanitizedConfig,
        createdAt: kbProvider.createdAt,
        updatedAt: kbProvider.updatedAt,
      },
    };

    return output;
  });
