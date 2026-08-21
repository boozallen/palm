import { z } from 'zod';
import crypto from 'crypto';

import { procedure } from '@/server/trpc';
import { storage } from '@/server/storage/redis';
import { getDocumentQueue } from '@/features/document-upload-provider/workers/documentQueue';
import createDocument from '@/features/shared/dal/document-library/upload/createDocument';
import { BadRequest } from '@/features/shared/errors/routeErrors';
import getDocuments from '@/features/shared/dal/document-library/upload/getDocuments';
import getEmbeddingModel from '@/features/shared/dal/getEmbeddingModel';
import { DOCUMENT_LIBRARY_DOCUMENT_LIMIT } from '@/features/shared/types/document';

export const NO_EMBEDDING_MODEL_MESSAGE =
  'Document upload requires an embedding model. Ask an administrator to designate a model as embeddings only on an AI provider your group has access to.';

const processDocumentSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number(),
  fileKey: z.string(),
  documentUploadProviderId: z.string(),
});

export default procedure
  .input(processDocumentSchema)
  .mutation(async ({ ctx, input }) => {
    // Document upload worker runs in dedicated document-upload-worker container
    // No need to start it here - just queue the job and the worker will pick it up

    const { fileName, contentType, fileSize, fileKey, documentUploadProviderId } = input;

    // Every uploaded document gets embedded, so without an embedding model the job
    // can only fail. Rejected here rather than in the worker so the user gets the
    // reason synchronously and no Document row is created for a doomed upload.
    // The UI hides its upload entry points on the same condition; this is the
    // authoritative check, since that state can go stale between renders.
    const embeddingModel = await getEmbeddingModel(ctx.userId);

    if (!embeddingModel) {
      throw BadRequest(NO_EMBEDDING_MODEL_MESSAGE);
    }

    const existingDocuments = await getDocuments({
      userId: ctx.userId,
      documentUploadProviderId,
    });

    // Check for document limit
    if (existingDocuments.length >= DOCUMENT_LIBRARY_DOCUMENT_LIMIT) {
      throw BadRequest(`Unable to process "${fileName}" because you have reached the document limit of ${DOCUMENT_LIBRARY_DOCUMENT_LIMIT} documents. Please delete unused documents to continue.`);
    }

    // Check for duplicate documents
    const duplicateRecordExists = existingDocuments.some((document) => fileName === document.filename);
    if (duplicateRecordExists) {
      throw BadRequest(`Unable to process "${fileName}" because this file already exists in your library.`);
    }

    try {
      ctx.logger.debug(`File uploaded to S3: ${fileName}`);

      // Create database record
      const document = await createDocument({
        userId: ctx.userId,
        filename: fileName,
        documentUploadProviderId,
      });

      ctx.logger.debug(`Document created in database: ${document.id}`);

      // Start processing job
      const jobId = crypto.randomUUID();
      const queue = getDocumentQueue();

      if (queue) {
        // Store job metadata in Redis
        await storage.hset(`document-job:${jobId}`, {
          status: 'queued',
          created: Date.now(),
          progress: 'File uploaded, queued for processing...',
          documentId: document.id,
          documentUploadProviderId,
          fileKey,
          fileName,
          contentType,
          fileSize: fileSize.toString(),
          userId: ctx.userId,
        });

        // Add job to queue - this will notify the worker
        await queue.add('documentProcessingJob', {
          documentId: document.id,
          documentUploadProviderId,
          jobId,
          userId: ctx.userId,
          fileKey,
          fileName,
          contentType,
          fileSize,
        });

        ctx.logger.debug(`Document processing job queued: ${jobId} for document: ${document.id}`);
      } else {
        ctx.logger.warn(
          'Document queue not available - file uploaded but processing will not start'
        );
      }

      return {
        success: true,
        documentId: document.id,
        documentUploadProviderId,
        jobId: queue ? jobId : null,
        fileName,
        fileKey,
        message: 'Document uploaded successfully and queued for processing',
      };
    } catch (error) {
      ctx.logger.error('Error confirming upload:', error);
      throw new Error('Failed to confirm document upload.');
    }
  });
