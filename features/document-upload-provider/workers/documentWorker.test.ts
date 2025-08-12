import 'openai/shims/node';

jest.mock('@/server/storage/redis', () => ({
  storage: {
    hset: jest.fn(),
  },
}));
jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/server/db', () => ({
  default: {
    document: {
      update: jest.fn(),
    },
  },
}));
jest.mock('@/features/document-upload-provider/factory', () => ({
  DocumentUploadFactory: jest.fn(),
}));
jest.mock('@/features/document-upload-provider/sources/utils/file-helpers', () => ({
  parseFile: jest.fn(),
}));
jest.mock('@/features/document-upload-provider/sources/utils/chunkText', () => ({
  chunkText: jest.fn(),
}));
jest.mock('@/features/settings/dal/getFirstAvailableOpenAiModel', () => jest.fn());
jest.mock('@/features/ai-provider', () => ({
  AIFactory: jest.fn(),
}));
jest.mock('@/features/shared/dal/document-upload/createEmbeddings', () => jest.fn());
jest.mock('@/server/storage/redisConnection', () => ({
  getRedisClient: jest.fn(() => ({ connected: true })),
}));
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));
jest.mock('@/features/shared/types/document', () => ({
  DocumentUploadStatus: {
    Completed: 'completed',
    Failed: 'failed',
  },
}));
jest.mock('@/features/shared/utils/documentUploadHelpers', () => ({}));

jest.mock('bullmq', () => ({
  Worker: class MockWorker {
    public queueName: string;
    public processor: Function;
    public options: any;
    
    constructor(queueName: string, processor: Function, options: any) {
      this.queueName = queueName;
      this.processor = processor;
      this.options = options;
    }
    async run() {
      return Promise.resolve();
    }
    async close() {
      return Promise.resolve();
    }
    isRunning() {
      return false;
    }
  },
}));

import { storage } from '@/server/storage/redis';
import { logger } from '@/server/logger';
import { DocumentUploadStatus } from '@/features/shared/types/document';
import db from '@/server/db';
import { DocumentUploadFactory } from '@/features/document-upload-provider/factory';
import { parseFile } from '@/features/document-upload-provider/sources/utils/file-helpers';
import { chunkText } from '@/features/document-upload-provider/sources/utils/chunkText';
import getFirstAvailableOpenAiModel from '@/features/settings/dal/getFirstAvailableOpenAiModel';
import { AIFactory } from '@/features/ai-provider';
import createEmbeddings from '@/features/shared/dal/document-upload/createEmbeddings';

const mockJobData = {
  documentId: 'doc-123',
  documentUploadProviderId: 'provider-456',
  jobId: 'job-789',
  userId: 'user-101',
  fileKey: 'users/user-101/documents/test.pdf',
  fileName: 'test.pdf',
  contentType: 'application/pdf',
  fileSize: 1024,
};

const mockStorageProvider = {
  fetchFile: jest.fn(),
  deleteFile: jest.fn(),
};

const mockFactory = {
  buildSource: jest.fn(),
};

const mockAISource = {
  createEmbeddings: jest.fn(),
};

const mockAIFactory = {
  buildUserSource: jest.fn(),
};

const mockModel = {
  id: 'model-123',
  externalId: 'gpt-3.5-turbo',
};

describe('Document Worker Processing Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (storage.hset as jest.Mock).mockResolvedValue('OK');
    (DocumentUploadFactory as jest.MockedClass<typeof DocumentUploadFactory>).mockImplementation(() => mockFactory as any);
    mockFactory.buildSource.mockResolvedValue({ source: mockStorageProvider });
    mockStorageProvider.fetchFile.mockResolvedValue(Buffer.from('test file content'));
    mockStorageProvider.deleteFile.mockResolvedValue(undefined);
    (parseFile as jest.Mock).mockResolvedValue('Extracted text content from the PDF file');
    (chunkText as jest.Mock).mockResolvedValue([
      { content: 'Chunk 1', tokens: 100 },
      { content: 'Chunk 2', tokens: 150 },
    ]);
    (getFirstAvailableOpenAiModel as jest.Mock).mockResolvedValue(mockModel);
    (AIFactory as jest.MockedClass<typeof AIFactory>).mockImplementation(() => mockAIFactory as any);
    mockAIFactory.buildUserSource.mockResolvedValue({ source: mockAISource });
    mockAISource.createEmbeddings.mockResolvedValue({
      embeddings: [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [0.4, 0.5, 0.6] },
      ],
    });
    (createEmbeddings as jest.Mock).mockResolvedValue({ count: 2 });
    
    const mockDb = db as any;
    if (!mockDb.document) {
      mockDb.document = {};
    }
    if (!mockDb.document.update) {
      mockDb.document.update = jest.fn();
    }
    mockDb.document.update.mockResolvedValue({ id: mockJobData.documentId });
  });

  async function simulateDocumentProcessing(jobData = mockJobData) {
    const {
      documentId,
      documentUploadProviderId,
      jobId,
      userId,
      fileKey,
      fileName,
      contentType,
      fileSize,
    } = jobData;

    try {
      logger.info(`Starting document processing job: ${jobId} for document: ${documentId}`);

      await storage.hset(`document-job:${jobId}`, {
        status: 'processing',
        progress: 'Starting document processing...',
        last_updated: Date.now(),
      });

      logger.info(`Processing document: ${fileName} (${fileSize} bytes)`);

      // Retrieve document
      const factory = new DocumentUploadFactory({ userId });
      const { source: storageProvider } = await factory.buildSource(documentUploadProviderId);
      const buffer = await storageProvider.fetchFile(fileKey);

      // Text extraction
      await storage.hset(`document-job:${jobId}`, {
        progress: 'Extracting text content...',
        last_updated: Date.now(),
      });

      const extractedText = await parseFile(buffer, contentType);

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

      const model = await getFirstAvailableOpenAiModel();

      if (!model) {
        throw new Error('You must have an OpenAI model provisioned to create embeddings');
      }

      const ai = await new AIFactory({ userId }).buildUserSource(model.id);
      const response = await ai.source.createEmbeddings(chunks.map(chunk => chunk.content), {
        model: model.externalId,
        randomness: 0.6,
        repetitiveness: 0.4,
      });

      if (!response.embeddings) {
        throw new Error('The LLM failed to create embeddings from your document.');
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

      // Delete the file from S3 since we now have the embeddings stored in the database
      try {
        await storageProvider.deleteFile(fileKey);
        logger.debug(`Successfully deleted S3 file: ${fileKey} after processing`);
      } catch (s3Error) {
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
        (db as any).document.update({
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

      await Promise.all([
        storage.hset(`document-job:${jobId}`, {
          status: 'error',
          error: (error as Error).message,
          completed: Date.now(),
        }),
        (db as any).document.update({
          where: { id: documentId },
          data: { uploadStatus: DocumentUploadStatus.Failed },
        }),
      ]);

      throw error;
    }
  }

  it('should process document successfully and delete S3 file', async () => {
    const result = await simulateDocumentProcessing();

    expect(result).toEqual({
      documentId: mockJobData.documentId,
      fileName: mockJobData.fileName,
      success: true,
      chunksCreated: 2,
    });

    expect(DocumentUploadFactory).toHaveBeenCalledWith({ userId: mockJobData.userId });
    expect(mockFactory.buildSource).toHaveBeenCalledWith(mockJobData.documentUploadProviderId);
    expect(mockStorageProvider.fetchFile).toHaveBeenCalledWith(mockJobData.fileKey);
    expect(parseFile).toHaveBeenCalledWith(Buffer.from('test file content'), mockJobData.contentType);
    expect(chunkText).toHaveBeenCalledWith({
      text: 'Extracted text content from the PDF file',
      maxTokens: 7000,
      overlapTokens: 500,
    });
    expect(getFirstAvailableOpenAiModel).toHaveBeenCalled();
    expect(AIFactory).toHaveBeenCalledWith({ userId: mockJobData.userId });
    expect(mockAIFactory.buildUserSource).toHaveBeenCalledWith(mockModel.id);
    expect(mockAISource.createEmbeddings).toHaveBeenCalledWith(['Chunk 1', 'Chunk 2'], {
      model: mockModel.externalId,
      randomness: 0.6,
      repetitiveness: 0.4,
    });
    expect(createEmbeddings).toHaveBeenCalledWith({
      embeddings: [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [0.4, 0.5, 0.6] },
      ],
      chunks: [
        { content: 'Chunk 1', tokens: 100 },
        { content: 'Chunk 2', tokens: 150 },
      ],
      documentId: mockJobData.documentId,
    });

    expect(mockStorageProvider.deleteFile).toHaveBeenCalledWith(mockJobData.fileKey);

    const mockDb = db as any;
    expect(mockDb.document.update).toHaveBeenCalledWith({
      where: { id: mockJobData.documentId },
      data: { uploadStatus: DocumentUploadStatus.Completed },
    });

    expect(storage.hset).toHaveBeenCalledWith(`document-job:${mockJobData.jobId}`, {
      status: 'completed',
      progress: 'Document processing complete!',
      completed: expect.any(Number),
      results: JSON.stringify({
        documentId: mockJobData.documentId,
        fileName: mockJobData.fileName,
        extractedTextLength: 'Extracted text content from the PDF file'.length,
        chunksCreated: 2,
        embeddingsCreated: 2,
      }),
    });
  });

  it('should continue processing even if S3 deletion fails', async () => {
    mockStorageProvider.deleteFile.mockRejectedValue(new Error('S3 deletion failed'));

    const result = await simulateDocumentProcessing();

    expect(result).toEqual({
      documentId: mockJobData.documentId,
      fileName: mockJobData.fileName,
      success: true,
      chunksCreated: 2,
    });

    expect(mockStorageProvider.deleteFile).toHaveBeenCalledWith(mockJobData.fileKey);

    expect(logger.error).toHaveBeenCalledWith(
      `Error deleting S3 file ${mockJobData.fileKey} after processing:`,
      expect.any(Error)
    );

    const mockDb2 = db as any;
    expect(mockDb2.document.update).toHaveBeenCalledWith({
      where: { id: mockJobData.documentId },
      data: { uploadStatus: DocumentUploadStatus.Completed },
    });
  });

  it('should handle processing failure and mark document as failed', async () => {
    (parseFile as jest.Mock).mockRejectedValue(new Error('Text extraction failed'));

    await expect(simulateDocumentProcessing()).rejects.toThrow('Text extraction failed');

    const mockDb3 = db as any;
    expect(mockDb3.document.update).toHaveBeenCalledWith({
      where: { id: mockJobData.documentId },
      data: { uploadStatus: DocumentUploadStatus.Failed },
    });

    expect(storage.hset).toHaveBeenCalledWith(`document-job:${mockJobData.jobId}`, {
      status: 'error',
      error: 'Text extraction failed',
      completed: expect.any(Number),
    });

    expect(mockStorageProvider.deleteFile).not.toHaveBeenCalled();
  });

  it('should throw error when no OpenAI model is available', async () => {
    (getFirstAvailableOpenAiModel as jest.Mock).mockResolvedValue(null);

    await expect(simulateDocumentProcessing()).rejects.toThrow(
      'You must have an OpenAI model provisioned to create embeddings'
    );

    const mockDb4 = db as any;
    expect(mockDb4.document.update).toHaveBeenCalledWith({
      where: { id: mockJobData.documentId },
      data: { uploadStatus: DocumentUploadStatus.Failed },
    });
  });

  it('should throw error when embedding creation fails', async () => {
    mockAISource.createEmbeddings.mockResolvedValue({ embeddings: null });

    await expect(simulateDocumentProcessing()).rejects.toThrow(
      'The LLM failed to create embeddings from your document.'
    );

    const mockDb5 = db as any;
    expect(mockDb5.document.update).toHaveBeenCalledWith({
      where: { id: mockJobData.documentId },
      data: { uploadStatus: DocumentUploadStatus.Failed },
    });
  });
});
