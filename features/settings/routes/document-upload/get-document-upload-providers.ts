import { z } from 'zod';

import { DocumentUploadProviderType } from '@/features/shared/types';
import { procedure } from '@/server/trpc';
import getDocumentUploadProviders from '@/features/settings/dal/document-upload/getDocumentUploadProviders';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';

const outputSchema = z.object({
  providers: z.array(
      z.object({
      id: z.string().uuid(),
      label: z.string(),
      providerType: z.nativeEnum(DocumentUploadProviderType),
      sourceUri: z.string(),
    }),
  ),
});

export default procedure
  .output(outputSchema)
  .query(async ({ ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden('You do not have permission to access this resource.');
    }

    const providers = await getDocumentUploadProviders();

    const sanitizedProviders = providers
      .map((provider) => {
        let sourceUri = '';

        switch (provider.config.providerType) {
          case DocumentUploadProviderType.AWS: {
            sourceUri = provider.config.s3Uri;
            break;
          }
          default: {
            sourceUri = '';
            break;
          }
        }

        return {
          id: provider.id,
          label: provider.label,
          providerType: provider.config.providerType,
          sourceUri,
        };
      });

    return { providers: sanitizedProviders };
  });
