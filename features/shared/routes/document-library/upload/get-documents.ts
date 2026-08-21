import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getDocuments from '@/features/shared/dal/document-library/upload/getDocuments';
import { DocumentSchema } from '@/features/shared/types/document';
import { BadRequest } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  documentUploadProviderId: z.string(),
});

const outputSchema = z.object({
  documents: z.array(DocumentSchema),
});

export default procedure.input(inputSchema).output(outputSchema)
.query(async ({ ctx, input }) => {
  const { userId } = ctx;
  const { documentUploadProviderId } = input;

    if (!documentUploadProviderId) {
      throw BadRequest('Requires a valid document upload provider');
    }

    const results = await getDocuments({ userId, documentUploadProviderId });

    return {
      documents: results.map((document) => ({
        id: document.id,
        userId: document.userId,
        filename: document.filename,
        createdAt: document.createdAt,
        uploadStatus: document.uploadStatus,
        text: document.text,
        adminCreated: document.adminCreated,
        assignedGroupIds: document.assignedGroupIds,
        assignedGroupLabels: document.assignedGroupLabels,
        collections: document.collections,
        // Forward only the metadata fields the UI needs. The raw dataProfile can
        // also hold an Excel `sheets` blob whose shape predates DataProfileSchema;
        // forwarding it wholesale would fail output validation and blank the list.
        dataProfile: document.dataProfile
          ? {
              type: document.dataProfile.type,
              summary: document.dataProfile.summary,
              date: document.dataProfile.date,
            }
          : null,
      })),
    };
  });
