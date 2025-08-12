import { procedure } from '@/server/trpc';
import updateKbProvider from '@/features/settings/dal/updateKbProvider';
import { z } from 'zod';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import {
  KbProviderType,
  sanitizedKbProviderBedrockConfigSchema,
  sanitizedKbProviderConfigSchema,
  sanitizedKbProviderPalmConfigSchema,
} from '@/features/shared/types';
import sanitizeKbProviderConfig
  from '@/features/settings/utils/sanitizeKbProviderConfig';

const inputSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  config: z.union([
    z.object({
      apiEndpoint: z.string(),
      apiKey: z.string(),
    }),
    z.object({
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
      sessionToken: z.string(),
      region: z.string(),
    }),

  ]),
});

const outputSchema = z.object({
  provider: z.object({
    id: z.string(),
    kbProviderType: z.nativeEnum(KbProviderType),
    label: z.string(),
    config: sanitizedKbProviderConfigSchema,
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource');
    }

    const result = await updateKbProvider({
      id: input.id,
      label: input.label,
      config: input.config,
    });

    const sanitizedConfig = sanitizeKbProviderConfig(result.config);

    let config;
    switch (result.kbProviderType) {
      case KbProviderType.KbProviderPalm:
        config = sanitizedKbProviderPalmConfigSchema.parse(sanitizedConfig);
        break;
      case KbProviderType.KbProviderBedrock:
        config = sanitizedKbProviderBedrockConfigSchema.parse(sanitizedConfig);
        break;
      default:
        throw new Error('Unsupported KbProviderType');
    }

    return {
      provider: {
        id: result.id,
        kbProviderType: result.kbProviderType,
        label: result.label,
        config: config,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
    };
  });
