import { KbProviderType } from '@/features/shared/types';
import { procedure } from '@/server/trpc';
import { z } from 'zod';
import { UserRole } from '@/features/shared/types/user';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';
import getKbProviders from '@/features/settings/dal/getKbProviders';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import sanitizeKbProviderConfig from '@/features/settings/utils/sanitizeKbProviderConfig';

const outputSchema = z.object({
  kbProviders: z.array(
    z.object({
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
          personalDocumentLibraryKnowledgeBaseId: z.string().optional(),
          dataSourceId: z.string().optional(),
          s3BucketUri: z.string().optional(),
        }),
      ]),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
});

type GetKbProvidersOutput = z.infer<typeof outputSchema>;

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      const lead = await getIsUserGroupLead(ctx.userId);
      if (!lead) {
        throw Forbidden('You do not have permission to access this resource.');
      }
    }

    const results = await getKbProviders();

    const output: GetKbProvidersOutput = {
      kbProviders: results.map((result) => {
        const sanitizedConfig = sanitizeKbProviderConfig(result.config);
        return {
          id: result.id,
          label: result.label,
          kbProviderType: result.kbProviderType,
          writeAccess: result.writeAccess,
          config: sanitizedConfig,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        };
      }),
    };

    return output;
  });
