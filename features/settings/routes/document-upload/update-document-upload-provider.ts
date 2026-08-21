import { z } from 'zod';

import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import { documentUploadProviderConfigSchema, DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';
import updateDocumentUploadProvider from '@/features/settings/dal/document-upload/updateDocumentUploadProvider';

const inputSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  config: documentUploadProviderConfigSchema,
});

const outputSchema = z.object({
  id: z.string(),
  label: z.string(),
  providerType: z.nativeEnum(DocumentUploadProviderType),
  sourceUri: z.string(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to access this resource.');
    }

    const provider = await updateDocumentUploadProvider({
      id: input.id,
      label: input.label,
      config: input.config,
    });

    let sourceUri = '';
    switch (provider.config.providerType) {
      case DocumentUploadProviderType.AWS: {
        sourceUri = provider.config.s3Uri;
        break;
      }
      /* Add more provider types here */
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
