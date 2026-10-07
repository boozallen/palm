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
jest.mock('@/features/document-upload-provider/sources/utils/chunkText', () => ({
  chunkText: jest.fn(),
}));
jest.mock('@/features/document-upload-provider/sources/utils/doclingClient', () => ({
  parseAndChunkWithDocling: jest.fn(),
}));
jest.mock('@/features/ai-provider/sources', () => ({
  BedrockSource: jest.fn(),
}));
jest.mock('@/features/shared/dal/document-library/upload/createEmbeddings', () => jest.fn());
jest.mock('@/features/shared/dal/document-library/upload/embedContent', () => ({
  embedContent: jest.fn(),
}));
jest.mock('@/features/shared/dal/getEmbeddingModel', () => jest.fn());
jest.mock('@/features/document-upload-provider/services/getMetadata', () => ({
  getMetadata: jest.fn(),
}));
jest.mock('@/features/document-upload-provider/services/getTabularDataSchema', () => ({
  getTabularDataSchema: jest.fn(),
}));
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
import { chunkText } from '@/features/document-upload-provider/sources/utils/chunkText';
import { parseAndChunkWithDocling } from '@/features/document-upload-provider/sources/utils/doclingClient';
import { TextChunk } from '@/features/document-upload-provider/sources/types';
import createEmbeddings from '@/features/shared/dal/document-library/upload/createEmbeddings';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingModel from '@/features/shared/dal/getEmbeddingModel';
import { InternalServerError } from '@/features/shared/errors/routeErrors';
import { getMetadata } from '@/features/document-upload-provider/services/getMetadata';

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
  transcribeAudioFile: jest.fn(),
};

const mockFactory = {
  buildSource: jest.fn(),
};

const mockEmbeddingModel = {
  id: 'model-embed-1',
  aiProviderId: 'provider-1',
  name: 'Titan Embed',
  externalId: 'amazon.titan-embed-text-v1',
  costPerInputToken: 0.0001,
  costPerOutputToken: 0,
  embeddingsOnly: true,
};

const mockExtractedText = 'Extracted text content from the PDF file';

function createMockChunks(): TextChunk[] {
  return [
    {
      content: 'Chunk 1',
      index: 0,
      tokenCount: 100,
      startPosition: 0,
      endPosition: 7,
    },
    {
      content: 'Chunk 2',
      index: 1,
      tokenCount: 150,
      startPosition: 9,
      endPosition: 16,
    },
  ];
}

function expectedChunks(fileName: string): TextChunk[] {
  const chunks = createMockChunks();
  chunks[0].content = `Document name: ${fileName}\n\n${chunks[0].content}`;
  return chunks;
}

describe('Document Upload Worker Processing Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (storage.hset as jest.Mock).mockResolvedValue('OK');
    (DocumentUploadFactory as jest.MockedClass<typeof DocumentUploadFactory>).mockImplementation(() => mockFactory as any);
    mockFactory.buildSource.mockResolvedValue({ source: mockStorageProvider });
    mockStorageProvider.fetchFile.mockResolvedValue(Buffer.from('test file content'));
    mockStorageProvider.deleteFile.mockResolvedValue(undefined);
    (parseAndChunkWithDocling as jest.Mock).mockResolvedValue({
      extractedText: mockExtractedText,
      chunks: createMockChunks(),
    });
    (chunkText as jest.Mock).mockResolvedValue(createMockChunks());
    (embedContent as jest.Mock).mockResolvedValue({
      embeddings: [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [0.4, 0.5, 0.6] },
      ],
    });
    (createEmbeddings as jest.Mock).mockResolvedValue({ count: 2 });
    (getMetadata as jest.Mock).mockResolvedValue(undefined);
    (getEmbeddingModel as jest.Mock).mockResolvedValue(mockEmbeddingModel);

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
      userGroupId,
    } = jobData as typeof mockJobData & { userGroupId?: string };

    try {
      logger.info(`Starting document processing job: ${jobId} for document: ${documentId}`);

      await storage.hset(`document-job:${jobId}`, {
        status: 'processing',
        progress: 'Starting document processing...',
        last_updated: Date.now(),
      });

      logger.info(`Processing document: ${fileName} (${fileSize} bytes)`);

      const embeddingModel = await getEmbeddingModel(userId, userGroupId);

      if (!embeddingModel) {
        throw InternalServerError(
          'No embedding model is available to you. Ask an administrator to designate a model as embeddings only on an AI provider your group has access to.'
        );
      }

      // Retrieve document
      const factory = new DocumentUploadFactory({ userId });
      const { source: storageProvider } = await factory.buildSource(documentUploadProviderId);

      // Determine if this is an audio file
      logger.debug(`Content type: ${contentType}`);
      const isAudioFile = contentType.startsWith('audio/') ||
        fileName.toLowerCase().endsWith('.mp3') ||
        fileName.toLowerCase().endsWith('.m4a');

      let extractedText: string;
      let chunks: TextChunk[];

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

        logger.debug(`Transcribed text: ${extractedText.slice(0, 50)}...`);

        await storage.hset(`document-job:${jobId}`, {
          progress: 'Chunking text content...',
          last_updated: Date.now(),
        });

        chunks = await chunkText({
          text: extractedText,
          maxTokens: 800,
          overlapTokens: 150,
        });
      } else {
        // Regular document processing workflow
        const buffer = await storageProvider.fetchFile(fileKey);

        await storage.hset(`document-job:${jobId}`, {
          progress: 'Parsing and chunking document...',
          last_updated: Date.now(),
        });

        const doclingResult = await parseAndChunkWithDocling({
          buffer,
          contentType,
          fileName,
          maxTokens: 800,
        });
        extractedText = doclingResult.extractedText;
        chunks = doclingResult.chunks;
      }

      // Add document name to the first chunk for better searchability
      if (chunks.length > 0) {
        chunks[0].content = `Document name: ${fileName}\n\n${chunks[0].content}`;
      }

      // Embedding generation
      await storage.hset(`document-job:${jobId}`, {
        progress: `Generating embeddings for ${chunks.length} chunks...`,
        last_updated: Date.now(),
      });

      logger.debug(`Creating embeddings for document: ${documentId}`);

      // Use the shared embedContent function
      const response = await embedContent(
        chunks.map(chunk => chunk.content),
        userId,
        embeddingModel.id,
        { documentId, stepLabel: 'ingestion' },
        userGroupId,
      );

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
          data: { 
            uploadStatus: DocumentUploadStatus.Completed,
            text: extractedText,
          },
        }),
      ]);

      logger.info(`Document processing completed: ${documentId}`);

      // Non-blocking document metadata triage. Runs AFTER the document is marked
      // Completed so readiness (and perceived upload speed) is never gated on it.
      // getMetadata is itself resilient; the wrapper is belt-and-suspenders.
      try {
        await getMetadata({ documentId, chunks, userId, userGroupId, fileName });
      } catch (error) {
        logger.error(`document metadata triage failed for ${documentId}:`, error);
      }

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
    expect(parseAndChunkWithDocling).toHaveBeenCalledWith({
      buffer: Buffer.from('test file content'),
      contentType: mockJobData.contentType,
      fileName: mockJobData.fileName,
      maxTokens: 800,
    });
    expect(parseAndChunkWithDocling).not.toHaveBeenCalledWith(
      expect.objectContaining({ overlapTokens: expect.anything() }),
    );
    expect(chunkText).not.toHaveBeenCalled();
    expect(embedContent).toHaveBeenCalledWith(
      ['Document name: test.pdf\n\nChunk 1', 'Chunk 2'],
      mockJobData.userId,
      mockEmbeddingModel.id,
      { documentId: mockJobData.documentId, stepLabel: 'ingestion' },
      undefined,
    );
    expect(createEmbeddings).toHaveBeenCalledWith({
      embeddings: [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [0.4, 0.5, 0.6] },
      ],
      chunks: expectedChunks(mockJobData.fileName),
      documentId: mockJobData.documentId,
    });

    expect(mockStorageProvider.deleteFile).toHaveBeenCalledWith(mockJobData.fileKey);

    const mockDb = db as any;
    expect(mockDb.document.update).toHaveBeenCalledWith({
      where: { id: mockJobData.documentId },
      data: { 
        uploadStatus: DocumentUploadStatus.Completed,
        text: mockExtractedText,
      },
    });

    expect(storage.hset).toHaveBeenCalledWith(`document-job:${mockJobData.jobId}`, {
      status: 'completed',
      progress: 'Document processing complete!',
      completed: expect.any(Number),
      results: JSON.stringify({
        documentId: mockJobData.documentId,
        fileName: mockJobData.fileName,
        extractedTextLength: mockExtractedText.length,
        chunksCreated: 2,
        embeddingsCreated: 2,
      }),
    });

    expect(getMetadata).toHaveBeenCalledWith({
      documentId: mockJobData.documentId,
      chunks: expectedChunks(mockJobData.fileName),
      userId: mockJobData.userId,
      fileName: mockJobData.fileName,
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
      data: { 
        uploadStatus: DocumentUploadStatus.Completed,
        text: mockExtractedText,
      },
    });
  });

  it('should handle processing failure and mark document as failed', async () => {
    (parseAndChunkWithDocling as jest.Mock).mockRejectedValue(
      new Error('Text extraction failed'),
    );

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

  describe('Embedding model gate', () => {
    it('should resolve the embedding model up front and pass its id to embedContent', async () => {
      await simulateDocumentProcessing();

      expect(getEmbeddingModel).toHaveBeenCalledWith(mockJobData.userId, undefined);
      expect(embedContent).toHaveBeenCalledWith(
        expect.any(Array),
        mockJobData.userId,
        mockEmbeddingModel.id,
        { documentId: mockJobData.documentId, stepLabel: 'ingestion' },
        undefined,
      );
    });

    it('should fail fast with an actionable error when no embedding model is available, without touching the file', async () => {
      (getEmbeddingModel as jest.Mock).mockResolvedValue(null);

      await expect(simulateDocumentProcessing()).rejects.toThrow(
        'No embedding model is available to you. Ask an administrator to designate a model as embeddings only on an AI provider your group has access to.'
      );

      expect(DocumentUploadFactory).not.toHaveBeenCalled();
      expect(mockStorageProvider.fetchFile).not.toHaveBeenCalled();
      expect(parseAndChunkWithDocling).not.toHaveBeenCalled();
      expect(embedContent).not.toHaveBeenCalled();

      const mockDb = db as any;
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: mockJobData.documentId },
        data: { uploadStatus: DocumentUploadStatus.Failed },
      });
    });

    it('passes the job\'s selected user group through to embedding resolution and usage', async () => {
      const jobDataWithGroup = { ...mockJobData, userGroupId: 'group-9' };

      await simulateDocumentProcessing(jobDataWithGroup);

      expect(getEmbeddingModel).toHaveBeenCalledWith(mockJobData.userId, 'group-9');
      expect(embedContent).toHaveBeenCalledWith(
        expect.any(Array),
        mockJobData.userId,
        mockEmbeddingModel.id,
        { documentId: mockJobData.documentId, stepLabel: 'ingestion' },
        'group-9',
      );
      expect(getMetadata).toHaveBeenCalledWith(expect.objectContaining({ userGroupId: 'group-9' }));
    });
  });

  it('should throw error when embedContent fails', async () => {
    (embedContent as jest.Mock).mockRejectedValue(new Error('No Bedrock AI provider and model configured'));

    await expect(simulateDocumentProcessing()).rejects.toThrow('No Bedrock AI provider and model configured');

    const mockDb4 = db as any;
    expect(mockDb4.document.update).toHaveBeenCalledWith({
      where: { id: mockJobData.documentId },
      data: { uploadStatus: DocumentUploadStatus.Failed },
    });
  });

  it('should throw error when embedding creation fails', async () => {
    (embedContent as jest.Mock).mockResolvedValue({ embeddings: null });

    await expect(simulateDocumentProcessing()).rejects.toThrow(
      'The LLM failed to create embeddings from your document.'
    );

    const mockDb5 = db as any;
    expect(mockDb5.document.update).toHaveBeenCalledWith({
      where: { id: mockJobData.documentId },
      data: { uploadStatus: DocumentUploadStatus.Failed },
    });
  });

  describe('Audio file processing', () => {
    const mockAudioJobData = {
      ...mockJobData,
      fileName: 'test-audio.mp3',
      contentType: 'audio/mpeg',
      fileKey: 'users/user-101/documents/test-audio.mp3',
    };

    beforeEach(() => {
      mockStorageProvider.transcribeAudioFile.mockResolvedValue(
        'This is the transcribed text from the audio file.'
      );
    });

    it('should process mp3 audio file using transcription workflow', async () => {
      const result = await simulateDocumentProcessing(mockAudioJobData);

      expect(result).toEqual({
        documentId: mockAudioJobData.documentId,
        fileName: mockAudioJobData.fileName,
        success: true,
        chunksCreated: 2,
      });

      // Should call transcribeAudioFile instead of fetchFile/Docling
      expect(mockStorageProvider.transcribeAudioFile).toHaveBeenCalledWith({
        fileKey: mockAudioJobData.fileKey,
        fileName: mockAudioJobData.fileName,
        onProgress: expect.any(Function),
      });
      expect(mockStorageProvider.fetchFile).not.toHaveBeenCalled();
      expect(parseAndChunkWithDocling).not.toHaveBeenCalled();

      // Should continue with normal chunking and embedding workflow
      expect(chunkText).toHaveBeenCalledWith({
        text: 'This is the transcribed text from the audio file.',
        maxTokens: 800,
        overlapTokens: 150,
      });

      expect(embedContent).toHaveBeenCalledWith(
        [
          'Document name: test-audio.mp3\n\nChunk 1',
          'Chunk 2',
        ],
        mockAudioJobData.userId,
        mockEmbeddingModel.id,
        { documentId: mockAudioJobData.documentId, stepLabel: 'ingestion' },
        undefined,
      );

      expect(mockStorageProvider.deleteFile).toHaveBeenCalledWith(mockAudioJobData.fileKey);
    });

    it('should process m4a audio file using transcription workflow', async () => {
      const m4aJobData = {
        ...mockJobData,
        fileName: 'test-audio.m4a',
        contentType: 'audio/m4a',
        fileKey: 'users/user-101/documents/test-audio.m4a',
      };

      const result = await simulateDocumentProcessing(m4aJobData);

      expect(result.success).toBe(true);
      expect(mockStorageProvider.transcribeAudioFile).toHaveBeenCalledWith({
        fileKey: m4aJobData.fileKey,
        fileName: m4aJobData.fileName,
        onProgress: expect.any(Function),
      });
      expect(mockStorageProvider.fetchFile).not.toHaveBeenCalled();
      expect(parseAndChunkWithDocling).not.toHaveBeenCalled();
    });

    it('should detect mp3 files by extension even with generic content type', async () => {
      const mp3WithGenericType = {
        ...mockJobData,
        fileName: 'voice-memo.mp3',
        contentType: 'application/octet-stream',
        fileKey: 'users/user-101/documents/voice-memo.mp3',
      };

      await simulateDocumentProcessing(mp3WithGenericType);

      expect(mockStorageProvider.transcribeAudioFile).toHaveBeenCalled();
      expect(mockStorageProvider.fetchFile).not.toHaveBeenCalled();
    });

    it('should detect m4a files by extension even with generic content type', async () => {
      const m4aWithGenericType = {
        ...mockJobData,
        fileName: 'recording.M4A', // Test uppercase extension
        contentType: 'application/octet-stream',
        fileKey: 'users/user-101/documents/recording.M4A',
      };

      await simulateDocumentProcessing(m4aWithGenericType);

      expect(mockStorageProvider.transcribeAudioFile).toHaveBeenCalled();
      expect(mockStorageProvider.fetchFile).not.toHaveBeenCalled();
    });

    it('should update progress during audio transcription', async () => {
      await simulateDocumentProcessing(mockAudioJobData);

      // Verify progress update for audio transcription start
      expect(storage.hset).toHaveBeenCalledWith(
        `document-job:${mockAudioJobData.jobId}`,
        {
          progress: 'Starting audio transcription...',
          last_updated: expect.any(Number),
        }
      );

      // Verify the onProgress callback was passed
      expect(mockStorageProvider.transcribeAudioFile).toHaveBeenCalledWith(
        expect.objectContaining({
          onProgress: expect.any(Function),
        })
      );
    });

    it('should handle transcription failures and mark document as failed', async () => {
      mockStorageProvider.transcribeAudioFile.mockRejectedValue(
        new Error('Transcription job failed: Invalid audio format')
      );

      await expect(simulateDocumentProcessing(mockAudioJobData)).rejects.toThrow(
        'Transcription job failed: Invalid audio format'
      );

      const mockDb = db as any;
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: mockAudioJobData.documentId },
        data: { uploadStatus: DocumentUploadStatus.Failed },
      });

      expect(storage.hset).toHaveBeenCalledWith(
        `document-job:${mockAudioJobData.jobId}`,
        {
          status: 'error',
          error: 'Transcription job failed: Invalid audio format',
          completed: expect.any(Number),
        }
      );

      // Should not delete S3 file on failure
      expect(mockStorageProvider.deleteFile).not.toHaveBeenCalled();
    });

    it('should process regular documents using file parsing workflow', async () => {
      // Use the original PDF job data
      const result = await simulateDocumentProcessing(mockJobData);

      expect(result.success).toBe(true);

      // Should use fetchFile and Docling for non-audio files
      expect(mockStorageProvider.fetchFile).toHaveBeenCalledWith(mockJobData.fileKey);
      expect(parseAndChunkWithDocling).toHaveBeenCalledWith({
        buffer: Buffer.from('test file content'),
        contentType: mockJobData.contentType,
        fileName: mockJobData.fileName,
        maxTokens: 800,
      });

      // Should NOT call transcribeAudioFile
      expect(mockStorageProvider.transcribeAudioFile).not.toHaveBeenCalled();
    });

    it('should store transcribed text in document record', async () => {
      const transcribedText = 'This is the transcribed text from the audio file.';
      mockStorageProvider.transcribeAudioFile.mockResolvedValue(transcribedText);

      const result = await simulateDocumentProcessing(mockAudioJobData);

      expect(result.success).toBe(true);

      const mockDb = db as any;
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: mockAudioJobData.documentId },
        data: { 
          uploadStatus: DocumentUploadStatus.Completed,
          text: transcribedText,
        },
      });
    });

    it('should handle empty transcription result', async () => {
      mockStorageProvider.transcribeAudioFile.mockResolvedValue('');

      // This should still process but result in no chunks or embeddings
      (chunkText as jest.Mock).mockResolvedValue([]);
      (embedContent as jest.Mock).mockResolvedValue({ embeddings: [] });
      (createEmbeddings as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await simulateDocumentProcessing(mockAudioJobData);

      expect(result.chunksCreated).toBe(0);
      expect(chunkText).toHaveBeenCalledWith({
        text: '',
        maxTokens: 800,
        overlapTokens: 150,
      });

      // Should still store empty text in document record
      const mockDb = db as any;
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: mockAudioJobData.documentId },
        data: { 
          uploadStatus: DocumentUploadStatus.Completed,
          text: '',
        },
      });
    });
  });

  describe('Text storage edge cases', () => {
    it('should handle very long extracted text', async () => {
      const veryLongText = 'A'.repeat(1000000); // 1MB of text
      (parseAndChunkWithDocling as jest.Mock).mockResolvedValue({
        extractedText: veryLongText,
        chunks: createMockChunks(),
      });

      const result = await simulateDocumentProcessing();

      expect(result.success).toBe(true);

      const mockDb = db as any;
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: mockJobData.documentId },
        data: { 
          uploadStatus: DocumentUploadStatus.Completed,
          text: veryLongText,
        },
      });
    });

    it('should handle text with special characters and unicode', async () => {
      const specialText = 'Text with émojis 🎉, ünicöde characters, and "quotes" & <tags>';
      (parseAndChunkWithDocling as jest.Mock).mockResolvedValue({
        extractedText: specialText,
        chunks: createMockChunks(),
      });

      const result = await simulateDocumentProcessing();

      expect(result.success).toBe(true);

      const mockDb = db as any;
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: mockJobData.documentId },
        data: { 
          uploadStatus: DocumentUploadStatus.Completed,
          text: specialText,
        },
      });
    });

    it('should handle completely empty extracted text', async () => {
      (parseAndChunkWithDocling as jest.Mock).mockResolvedValue({
        extractedText: '',
        chunks: [],
      });
      (embedContent as jest.Mock).mockResolvedValue({ embeddings: [] });
      (createEmbeddings as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await simulateDocumentProcessing();

      expect(result.success).toBe(true);
      expect(result.chunksCreated).toBe(0);

      const mockDb = db as any;
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: mockJobData.documentId },
        data: {
          uploadStatus: DocumentUploadStatus.Completed,
          text: '',
        },
      });
    });
  });

  describe('Document triage', () => {
    it('should call getMetadata after document is marked completed', async () => {
      await simulateDocumentProcessing();

      expect(getMetadata).toHaveBeenCalledWith({
        documentId: mockJobData.documentId,
        chunks: expectedChunks(mockJobData.fileName),
        userId: mockJobData.userId,
        fileName: mockJobData.fileName,
      });
    });

    it('should continue successfully even if getMetadata fails', async () => {
      (getMetadata as jest.Mock).mockRejectedValue(new Error('Triage LLM timeout'));

      const result = await simulateDocumentProcessing();

      expect(result).toEqual({
        documentId: mockJobData.documentId,
        fileName: mockJobData.fileName,
        success: true,
        chunksCreated: 2,
      });

      expect(logger.error).toHaveBeenCalledWith(
        `document metadata triage failed for ${mockJobData.documentId}:`,
        expect.any(Error)
      );

      const mockDb = db as any;
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: mockJobData.documentId },
        data: {
          uploadStatus: DocumentUploadStatus.Completed,
          text: mockExtractedText,
        },
      });
    });

    it('should call getMetadata for audio files with transcribed text', async () => {
      const mockAudioJobData = {
        ...mockJobData,
        fileName: 'test-audio.mp3',
        contentType: 'audio/mpeg',
        fileKey: 'users/user-101/documents/test-audio.mp3',
      };

      mockStorageProvider.transcribeAudioFile.mockResolvedValue(
        'This is the transcribed text from the audio file.'
      );

      await simulateDocumentProcessing(mockAudioJobData);

      expect(getMetadata).toHaveBeenCalledWith({
        documentId: mockAudioJobData.documentId,
        chunks: expectedChunks(mockAudioJobData.fileName),
        userId: mockAudioJobData.userId,
        fileName: mockAudioJobData.fileName,
      });
    });
  });
});
