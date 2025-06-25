import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import {
  KbProviderType,
  KbProviderPalmConfigSchema,
  kbProviderBedrockConfigSchema,
} from '@/features/shared/types';
import createKbProvider from '@/features/settings/dal/createKbProvider';
import logger from '@/server/logger';
import sanitizeKbProviderConfig from '@/features/settings/utils/sanitizeKbProviderConfig';

const inputSchema = z.object({
  label: z.string().min(1, 'A label is required'),
  kbProviderType: z.nativeEnum(KbProviderType),
  writeAccess: z.boolean(),
  config: z.union([
    z.object({
      apiKey: z.string(),
      apiEndpoint: z.string(),
    }),
    z.object({
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
      sessionToken: z.string(),
      region: z.string(),
      personalDocumentLibraryKnowledgeBaseId: z.string().optional(),
      dataSourceId: z.string().optional(),
      s3BucketUri: z.string().optional(),
    }),
  ]),
});
const outputSchema = z.object({
  kbProvider: z.object({
    id: z.string().uuid(),
    label: z.string(),
    kbProviderType: z.nativeEnum(KbProviderType),
    writeAccess: z.boolean(),
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
  .mutation(async ({ ctx, input }) => {
    // Check if user has permission to add KB provider
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to add a knowledge base provider');
    }

    let inputConfig;
    try {
      // Validate the config based on the kbProviderType
      switch (input.kbProviderType) {
        case KbProviderType.KbProviderPalm:
          inputConfig = KbProviderPalmConfigSchema.parse(input.config);
          break;
        case KbProviderType.KbProviderBedrock:
          inputConfig = kbProviderBedrockConfigSchema.parse(input.config);
          break;
        default:
          logger.error('Invalid kbProviderType');
          throw new Error('Invalid kbProviderType');
      }
    } catch (error) {
      logger.error('Type mismatch between KB provider and its config', error);
      throw new Error('There was a problem adding the knowledge base provider');
    }

    const kbProvider = await createKbProvider({
      label: input.label,
      kbProviderType: input.kbProviderType,
      writeAccess: input.writeAccess,
      config: inputConfig,
    });

    const output: z.infer<typeof outputSchema> = {
      kbProvider: {
        id: kbProvider.id,
        label: kbProvider.label,
        kbProviderType: kbProvider.kbProviderType,
        writeAccess: kbProvider.writeAccess,
        config: sanitizeKbProviderConfig(kbProvider.config),
        createdAt: kbProvider.createdAt,
        updatedAt: kbProvider.updatedAt,
      },
    };

    return output;
  });
