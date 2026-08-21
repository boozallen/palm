import { Worker } from 'bullmq';

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { DocumentJobData } from '@/features/document-upload-provider/workers/documentQueue';
import { getRedisClient } from '@/server/storage/redisConnection';
import { DataProfile, DocumentUploadStatus, TABULAR_DATA_MIME_TYPES } from '@/features/shared/types/document';
import { Prisma } from '@prisma/client';
import db from '@/server/db';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { parseFile } from '@/features/document-upload-provider/sources/utils/file-helpers';
import { chunkText } from '@/features/document-upload-provider/sources/utils/chunkText';
import { InternalServerError } from '@/features/shared/errors/routeErrors';
import createEmbeddings from '@/features/shared/dal/document-library/upload/createEmbeddings';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingModel from '@/features/shared/dal/getEmbeddingModel';
import { getMetadata } from '@/features/document-upload-provider/services/getMetadata';
import { getTabularDataSchema } from '@/features/document-upload-provider/services/getTabularDataSchema';

// Bedrock (3) and Anthropic (5) are the only providers that implement chatCompletionWithTools,
// which is required by the Analyst Agent (Claude Agent SDK) for data analysis.
const TOOL_CAPABLE_PROVIDER_TYPE_IDS = [3, 5];

async function userHasToolCapableModel(userId: string): Promise<boolean> {
  const count = await db.model.count({
    where: {
      deletedAt: null,
      aiProvider: {
        aiProviderTypeId: { in: TOOL_CAPABLE_PROVIDER_TYPE_IDS },
        deletedAt: null,
        userGroups: {
          some: {
            userGroupMemberships: { some: { userId } },
          },
        },
      },
    },
  });
  return count > 0;
}

let worker: Worker | null = null;
let shutdownInProgress = false;
let isStarting = false;
let workerStarted = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownInProgress) {
    return;
  }
  shutdownInProgress = true;

  logger.info(`[DOC-UPLOAD] ${signal} received, shutting down document upload worker...`);

  try {
    if (worker) {
      const forceShutdownTimeout = setTimeout(() => {
        logger.warn('[DOC-UPLOAD] Force shutting down document upload worker after timeout');
        process.exit(1);
      }, 15000);

      await worker.close();
      clearTimeout(forceShutdownTimeout);
      worker = null;
      workerStarted = false;
      logger.info('[DOC-UPLOAD] Document upload worker closed successfully');
    }
  } catch (error) {
    logger.error('[DOC-UPLOAD] Error shutting down document upload worker:', error);
    throw error;
  }
};

export const startDocumentUploadWorker = async (): Promise<void> => {
  logger.info('[DOC-UPLOAD] startDocumentUploadWorker called, current state:', {
    isStarting,
    workerExists: !!worker,
    workerRunning: worker?.isRunning() || false,
    workerStarted,
  });

  if (isStarting) {
    logger.info('[DOC-UPLOAD] Document upload worker is already starting, skipping duplicate call');
    return;
  }

  if (workerStarted && worker?.isRunning()) {
    logger.info('[DOC-UPLOAD] Document upload worker is already running, skipping initialization');
    return;
  }

  isStarting = true;

  let connection;

  try {
    connection = getRedisClient();
  } catch (error) {
    logger.warn('[DOC-UPLOAD] Redis not available — skipping document queue/worker startup.');
    isStarting = false;
    return;
  }

  if (!storage) {
    logger.warn('[DOC-UPLOAD] Storage is not enabled, skipping document upload worker startup.');
    isStarting = false;
    return;
  }

  // Always close existing worker instance if it exists
  if (worker) {
    logger.info('[DOC-UPLOAD] Worker instance exists, attempting to close...');
    try {
      // Always try to close the worker, regardless of isRunning() status
      // because isRunning() might not reflect the actual internal state
      await worker.close();
      logger.info('[DOC-UPLOAD] Existing worker closed successfully');
      worker = null;
      workerStarted = false;
      // Add a delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (closeError) {
      logger.warn('[DOC-UPLOAD] Error closing existing worker (ignoring):', closeError);
      worker = null;
      workerStarted = false;
    }
  }

  logger.info('[DOC-UPLOAD] Creating new Worker instance...');

  // Create a unique worker name to avoid conflicts
  const workerId = `worker-${process.pid}-${Date.now()}`;
  logger.info('[DOC-UPLOAD] Using worker ID:', workerId);

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
          `[DOC-UPLOAD] Starting document processing job: ${jobId} for document: ${documentId}`
        );

        // Update job status
        await storage.hset(`document-job:${jobId}`, {
          status: 'processing',
          progress: 'Starting document processing...',
          last_updated: Date.now(),
        });

        logger.info(`[DOC-UPLOAD] Processing document: ${fileName} (${fileSize} bytes)`);

        // Nothing downstream works without an embedding model, and no provider is
        // guaranteed to have one now that models are hand-configured. Resolved up
        // front so a misconfigured install fails immediately with an actionable
        // message, rather than after fetching, parsing and chunking the file. The
        // id is then reused for every batch instead of re-resolved per batch.
        const embeddingModel = await getEmbeddingModel(userId);

        if (!embeddingModel) {
          throw InternalServerError(
            'No embedding model is available to you. Ask an administrator to designate a model as embeddings only on an AI provider your group has access to.'
          );
        }

        // Retrieve document
        const factory = new DocumentUploadFactory({ userId });
        const { source: storageProvider } = await factory.buildSource(
          documentUploadProviderId
        );

        // Determine if this is an audio file
        logger.debug(`[DOC-UPLOAD] Content type: ${contentType}`);
        const isAudioFile = contentType.startsWith('audio/') ||
          fileName.toLowerCase().endsWith('.mp3') ||
          fileName.toLowerCase().endsWith('.m4a') ||
          fileName.toLowerCase().endsWith('.wav');

        let extractedText: string;
        let docxSourceJson: Prisma.InputJsonValue | null = null;

        if (isAudioFile) {
          // Audio transcription workflow
          await storage.hset(`document-job:${jobId}`, {
            progress: 'Starting audio transcription...',
            last_updated: Date.now(),
          });

          extractedText = await storageProvider.transcribeAudioFile({
            fileKey,
            fileName,
            onProgress: async (progress) => {
              await storage.hset(`document-job:${jobId}`, {
                progress,
                last_updated: Date.now(),
              });
            },
          });

          logger.debug(`[DOC-UPLOAD] Transcribed text: ${extractedText.slice(0, 50)}...`);
        } else {
          // Regular document processing workflow
          const buffer = await storageProvider.fetchFile(fileKey);

          // Text extraction
          await storage.hset(`document-job:${jobId}`, {
            progress: 'Extracting text content...',
            last_updated: Date.now(),
          });

          extractedText = await parseFile(buffer, contentType);
          logger.debug(`[DOC-UPLOAD] Extracted text: ${extractedText.slice(0, 50)}...`);

          // For .docx files, parse structure into sourceJson via claude-service
          const isDocx = contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            || fileName.toLowerCase().endsWith('.docx');
          if (isDocx) {
            try {
              const claudeServiceUrl = process.env.CLAUDE_SERVICE_URL ?? 'http://claude-service:8000';
              const internalApiKey = process.env.INTERNAL_API_KEY ?? '';
              const parseResp = await fetch(`${claudeServiceUrl}/parse-docx`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${internalApiKey}`,
                },
                body: JSON.stringify({ docx_base64: buffer.toString('base64') }),
              });
              if (parseResp.ok) {
                const parsed = await parseResp.json() as { source_json?: Prisma.InputJsonValue };
                docxSourceJson = parsed.source_json ?? null;
                logger.info(`[DOC-UPLOAD] Parsed sourceJson for docx: ${documentId}`);
              } else {
                logger.warn(`[DOC-UPLOAD] parse-docx failed for ${documentId}: ${parseResp.status}`);
              }
            } catch (parseError) {
              logger.warn(`[DOC-UPLOAD] parse-docx error for ${documentId}:`, parseError);
            }
          }
        }

        // Validate that text extraction was successful
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error(`No text could be extracted from "${fileName}". This may be an image-based PDF that requires OCR, or the file may be corrupted.`);
        }

        // Text chunking
        await storage.hset(`document-job:${jobId}`, {
          progress: 'Chunking text content...',
          last_updated: Date.now(),
        });

        const chunks = await chunkText({
          text: extractedText,
          maxTokens: 800,
          overlapTokens: 150,
        });

        // Add document name to the first chunk for improved searchability
        if (chunks.length > 0) {
          chunks[0].content = `Document name: ${fileName} \n\n${chunks[0].content}`;
        }

        // Embedding generation — batched to keep memory flat for large documents
        const EMBED_BATCH_SIZE = 100;
        const totalBatches = Math.ceil(chunks.length / EMBED_BATCH_SIZE);
        let totalEmbeddingsCreated = 0;

        logger.debug(`[EMBED] Creating embeddings for document: ${documentId} in ${totalBatches} batches`);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchStart = batchIndex * EMBED_BATCH_SIZE;
          const chunkBatch = chunks.slice(batchStart, batchStart + EMBED_BATCH_SIZE);

          await storage.hset(`document-job:${jobId}`, {
            progress: `Generating embeddings (batch ${batchIndex + 1}/${totalBatches})...`,
            last_updated: Date.now(),
          });

          const response = await embedContent(
            chunkBatch.map((chunk) => chunk.content),
            userId,
            embeddingModel.id,
            { documentId, stepLabel: 'ingestion' },
          );

          if (!response.embeddings) {
            throw InternalServerError('The LLM failed to create embeddings from your document.');
          }

          const result = await createEmbeddings({
            embeddings: response.embeddings,
            chunks: chunkBatch,
            documentId,
          });

          totalEmbeddingsCreated += result.count;
          logger.debug(`[EMBED] Stored batch ${batchIndex + 1}/${totalBatches} (${result.count} embeddings, ${totalEmbeddingsCreated} total)`);
        }

        logger.debug(`[EMBED] Successfully created ${totalEmbeddingsCreated} embeddings`);

        // START non-blocking document analysis, saves results to document.dataProfile
        const dataProfile: DataProfile = {
          sheets: undefined,
          type: undefined,
          date: undefined,
          summary: undefined,
        };

        try {
          const metadata = await getMetadata({ documentId, chunks, userId, fileName });
          if (metadata) {
            dataProfile.type = metadata.type;
            dataProfile.date = metadata.date;
            dataProfile.summary = metadata.summary;
          }
        } catch (error) {
          logger.warn(`[DOC-UPLOAD] document metadata analysis failed for ${documentId}:`, error);
        }

        if (TABULAR_DATA_MIME_TYPES.includes(contentType) && await userHasToolCapableModel(userId)) {
          logger.info(`[DOC-UPLOAD] Starting data profile for structured file: ${documentId}`);
          await storage.hset(`document-job:${jobId}`, {
            progress: 'Profiling structured data...',
            last_updated: Date.now(),
          });
          const rawBuffer = await storageProvider.fetchFile(fileKey);
          const schemaData = await getTabularDataSchema(documentId, fileName, rawBuffer);
          if (schemaData) {
            dataProfile.sheets = schemaData.sheets;
          }
        }

        await db.document.update({
          where: { id: documentId },
          data: { dataProfile: dataProfile as Prisma.InputJsonValue },
        });

        logger.info(`[DOC-UPLOAD] data profile stored for ${documentId}`);
        // END non-blocking document analysis, saves results to document.dataProfile

        // Delete the file from S3
        logger.info(`[DOC-UPLOAD] Starting S3 file deletion: ${fileKey}`);
        try {
          await storageProvider.deleteFile(fileKey);
          logger.info(`[DOC-UPLOAD] Successfully deleted S3 file: ${fileKey} after processing`);
        } catch (s3Error) {
          // Log S3 deletion error but don't fail the entire job
          // The document processing was successful, S3 cleanup is optional
          logger.error(`[DOC-UPLOAD] Error deleting S3 file ${fileKey} after processing:`, s3Error);
        }

        // Mark as completed and store extracted text
        logger.info(`[DOC-UPLOAD] Updating document status to Completed and storing text for: ${documentId}`);
        
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
              embeddingsCreated: totalEmbeddingsCreated,
            }),
          }),
          db.document.update({
            where: { id: documentId },
            data: {
              uploadStatus: DocumentUploadStatus.Completed,
              text: extractedText,
              ...(docxSourceJson !== null ? { sourceJson: docxSourceJson } : {}),
            },
          }),
        ]);

        logger.info(`[DOC-UPLOAD] Document processing completed: ${documentId}`);

        return {
          documentId,
          fileName,
          success: true,
          chunksCreated: chunks.length,
        };
      } catch (error) {
        logger.error(`[DOC-UPLOAD] Document processing failed: ${documentId}`, error);

        // Clean up any embeddings committed before the failure so the document
        // doesn't end up in a partially-embedded state
        await db.embedding.deleteMany({ where: { documentId } }).catch((deleteError) => {
          logger.error(`[DOC-UPLOAD] Failed to clean up partial embeddings for ${documentId}`, deleteError);
        });

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
      lockDuration: 600000, // 10 minutes — large documents can take longer to embed
      concurrency: 5, // Process 5 documents at once
      limiter: {
        max: 10,
        duration: 5000,
      },
      stalledInterval: 60000, // 1 minute
      maxStalledCount: 2,
      name: workerId, // Use unique worker ID
    }
  );

  // Graceful shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    logger.info('[DOC-UPLOAD] About to call worker.run()...');

    // Double check that worker is not already running before calling run()
    if (worker.isRunning()) {
      logger.info('[DOC-UPLOAD] Worker is already running, skipping run() call');
      isStarting = false;
      return;
    }
    
    await worker.run();
    logger.info('[DOC-UPLOAD] Document upload worker started successfully');
    workerStarted = true;
    isStarting = false;
  } catch (error) {
    logger.error('[DOC-UPLOAD] Caught error in worker.run():', error);
    isStarting = false;
    if (error instanceof Error && error.message.includes('already running')) {
      logger.info('[DOC-UPLOAD] Worker was already running, ignoring error and continuing');
      // Don't throw the error, just return gracefully
      return;
    }
    logger.error('[DOC-UPLOAD] Re-throwing unexpected error:', error);
    throw error;
  }
};
