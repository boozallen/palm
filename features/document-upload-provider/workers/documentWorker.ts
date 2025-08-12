import { Worker } from 'bullmq';

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { DocumentJobData } from '@/features/document-upload-provider/workers/documentQueue';
import { getRedisClient } from '@/server/storage/redisConnection';
import { DocumentUploadStatus } from '@/features/shared/types/document';
import db from '@/server/db';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { parseFile } from '@/features/document-upload-provider/sources/utils/file-helpers';
import { chunkText } from '@/features/document-upload-provider/sources/utils/chunkText';
import getUserFirstAvailableOpenAiModel from '@/features/shared/dal/getUserFirstAvailableOpenAiModel';
import { AIFactory } from '@/features/ai-provider';
import { BadRequest, InternalServerError } from '@/features/shared/errors/routeErrors';
import { AiSettings } from '@/types';
import createEmbeddings from '@/features/shared/dal/document-upload/createEmbeddings';

let worker: Worker | null = null;
let shutdownInProgress = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }
  shutdownInProgress = true;

  logger.info(`${signal} received, shutting down document worker...`);

  try {
    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('Force shutting down document worker after timeout');
        process.exit(1);
      }, 15000);

      await worker.close();
      clearTimeout(forceShutdownTimeout);
      logger.info('Document worker closed successfully');
    }
  } catch (error) {
    logger.error('Error shutting down document worker:', error);
    throw error;
  }
};

export const startDocumentWorker = async (): Promise<void> => {
  let connection;

  try {
    connection = getRedisClient();
  } catch (error) {
    logger.info(
      'Redis not available — skipping document queue/worker startup.'
    );
    return;
  }

  if (!storage) {
    logger.warn('Storage is not enabled, skipping document worker startup.');
    return;
  }

  if (worker?.isRunning()) {
    logger.info('Document worker is already running, skipping initialization');
    return;
  }

  worker = new Worker<DocumentJobData>(
    'document-jobs',
    async (job) => {
      const {
        documentId,
        documentUploadProviderId,
        jobId,
        userId,
        fileKey,
        fileName,
        contentType,
        fileSize,
      } = job.data;

      try {
        logger.info(
          `Starting document processing job: ${jobId} for document: ${documentId}`
        );

        // Update job status
        await storage.hset(`document-job:${jobId}`, {
          status: 'processing',
          progress: 'Starting document processing...',
          last_updated: Date.now(),
        });

        logger.info(`Processing document: ${fileName} (${fileSize} bytes)`);

        // Retrieve document
        const factory = new DocumentUploadFactory({ userId });
        const { source: storageProvider } = await factory.buildSource(
          documentUploadProviderId
        );
        const buffer = await storageProvider.fetchFile(fileKey);

        // Text extraction
        await storage.hset(`document-job:${jobId}`, {
          progress: 'Extracting text content...',
          last_updated: Date.now(),
        });

        const extractedText = await parseFile(buffer, contentType);
        logger.debug(`extracted text: ${extractedText.slice(0, 50)}...`);

        // Text chunking
        await storage.hset(`document-job:${jobId}`, {
          progress: 'Chunking text content...',
          last_updated: Date.now(),
        });

        const chunks = await chunkText({
          text: extractedText,
          maxTokens: 7000,
          overlapTokens: 500,
        });

        // Embedding generation
        await storage.hset(`document-job:${jobId}`, {
          progress: `Generating embeddings for ${chunks.length} chunks...`,
          last_updated: Date.now(),
        });

        logger.debug(`Creating embeddings for document: ${documentId}`);
        const model = await getUserFirstAvailableOpenAiModel(userId);

        if (!model) {
          throw BadRequest('You must have an OpenAI model provisioned to create embeddings');
        }

        const aiSettings: AiSettings = {
          model: model.externalId,
          randomness: 0.6,
          repetitiveness: 0.4,
        };

        const ai = await new AIFactory({ userId }).buildUserSource(model.id);
        const response = await ai.source.createEmbeddings(chunks.map(chunk => chunk.content), aiSettings);

        if (!response.embeddings) {
          throw InternalServerError('The LLM failed to create embeddings from your document.');
        }

        await storage.hset(`document-job:${jobId}`, {
          progress: 'Storing embeddings in database...',
          last_updated: Date.now(),
        });

        const embeddings = await createEmbeddings({
          embeddings: response.embeddings,
          chunks: chunks,
          documentId,
        });

        logger.debug(`Successfully created ${embeddings.count} embeddings`);

        // Delete the file from S3
        try {
          await storageProvider.deleteFile(fileKey);
          logger.debug(`Successfully deleted S3 file: ${fileKey} after processing`);
        } catch (s3Error) {
          // Log S3 deletion error but don't fail the entire job
          // The document processing was successful, S3 cleanup is optional
          logger.error(`Error deleting S3 file ${fileKey} after processing:`, s3Error);
        }

        // Mark as completed
        await Promise.all([
          storage.hset(`document-job:${jobId}`, {
            status: 'completed',
            progress: 'Document processing complete!',
            completed: Date.now(),
            results: JSON.stringify({
              documentId,
              fileName,
              extractedTextLength: extractedText.length,
              chunksCreated: chunks.length,
              embeddingsCreated: chunks.length,
            }),
          }),
          db.document.update({
            where: { id: documentId },
            data: { uploadStatus: DocumentUploadStatus.Completed },
          }),
        ]);

        logger.info(`Document processing completed: ${documentId}`);

        return {
          documentId,
          fileName,
          success: true,
          chunksCreated: chunks.length,
        };
      } catch (error) {
        logger.error(`Document processing failed: ${documentId}`, error);

        // Mark job and document as failed
        await Promise.all([
          storage.hset(`document-job:${jobId}`, {
            status: 'error',
            error: (error as Error).message,
            completed: Date.now(),
          }),
          db.document.update({
            where: { id: documentId },
            data: { uploadStatus: DocumentUploadStatus.Failed },
          }),
        ]);

        throw error;
      }
    },
    {
      connection,
      lockDuration: 300000, // 5 minutes
      concurrency: 2, // Process 2 documents at once
      limiter: {
        max: 2,
        duration: 5000,
      },
      stalledInterval: 60000, // 1 minute
      maxStalledCount: 2,
    }
  );

  // Graceful shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await worker.run();
  logger.info('Document worker started successfully');
};
