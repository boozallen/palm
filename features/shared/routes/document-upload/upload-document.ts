import { z } from 'zod';
import crypto from 'crypto';
import { TRPCError } from '@trpc/server';

import { procedure } from '@/server/trpc';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { storage } from '@/server/storage/redis';
import { getDocumentQueue } from '@/features/document-upload-provider/workers/documentQueue';
import createDocument from '@/features/shared/dal/document-upload/createDocument';
import { BadRequest, Unauthorized } from '@/features/shared/errors/routeErrors';
import getDocuments from '@/features/shared/dal/document-upload/getDocuments';

const uploadDocumentSchema = z.object({
  file: z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    data: z.string(),
  }),
  documentUploadProviderId: z.string(),
});

export default procedure
  .input(uploadDocumentSchema)
  .mutation(async ({ ctx, input }) => {
    const { file, documentUploadProviderId } = input;
    const {
      name: fileName,
      type: contentType,
      size: fileSize,
      data: fileData,
    } = file;

    if (!documentUploadProviderId) {
      throw BadRequest('Upload requires a valid document upload provider ');
    }

   const existingDocuments = await getDocuments({
      userId: ctx.userId,
      documentUploadProviderId,
    });

    const duplicateRecordExists = existingDocuments.some((document) => fileName === document.filename);
    if (duplicateRecordExists) {
      throw BadRequest(`Unable to process "${fileName}" because this file already exists in your library.`);
    }

    try {
      ctx.logger.debug(
        `Starting document upload for: ${fileName} for user: ${ctx.userId}`
      );

      // STEP 1: Build document upload source from provider
      const factory = new DocumentUploadFactory({ userId: ctx.userId });
      const { source: storageProvider } = await factory.buildSource(
        documentUploadProviderId
      );

      // STEP 2: Generate presigned URL
      const { presignedUrl, fileKey } =
        await storageProvider.generatePresignedUploadUrl(
          fileName,
          contentType,
          ctx.userId
        );

      ctx.logger.debug(`Presigned URL generated for: ${fileName}`);

      // STEP 3: Upload file to S3 using presigned URL
      const fileBuffer = Buffer.from(fileData, 'base64');

      const s3Response = await fetch(presignedUrl, {
        method: 'PUT',
        body: fileBuffer,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!s3Response.ok) {
        const errorText = await s3Response.text();
        if (errorText.includes('<Code>ExpiredToken</Code>')) {
          throw Unauthorized('Your Document Upload Provider\'s AWS connection is invalid. Contact your admin to resolve this issue.');
        }
        throw new Error(
          `S3 upload failed: ${s3Response.status} - ${errorText}`
        );
      }

      ctx.logger.debug(`File uploaded to S3: ${fileName}`);

      // STEP 4: Create database record
      const document = await createDocument({
        userId: ctx.userId,
        filename: fileName,
        documentUploadProviderId,
      });

      ctx.logger.debug(`Document created in database: ${document.id}`);

      // STEP 5: Start processing job
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

        ctx.logger.debug(
          `Document processing job queued: ${jobId} for document: ${document.id}`
        );
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
      ctx.logger.error('Error in document upload:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new Error('Failed to process document. Check your configuration and try again later.');
    }
  });
