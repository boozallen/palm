import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
} from '@aws-sdk/client-bedrock-agent';
import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  PutObjectCommandOutput,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

import { BedrockSource, SearchInput } from '@/features/kb-provider/sources';
import { kbProviderBedrockConfigSchema } from '@/features/shared/types';
import { maxResults, minScore } from '@/features/shared/utils/kbProvider';
import logger from '@/server/logger';
import { UserDocument } from '@/features/profile/types/document';

jest.mock('@aws-sdk/client-bedrock-agent-runtime');
jest.mock('@aws-sdk/client-bedrock-agent');
jest.mock('@aws-sdk/client-s3');

describe('BedrockSource', () => {
  const mockConfig = {
    accessKeyId: '60c410be-11b0-4b78-ad85-dceeeb0701cd',
    secretAccessKey: 'Test Key',
    sessionToken: 'Test Token',
    region: 'east-1',
    personalDocumentLibraryKnowledgeBaseId: 'PDL-id',
    dataSourceId: 'source-id',
    s3BucketUri: 's3://my-bucket',
  };

  const mockInvalidConfig = {
    accessKeyId: '',
    secretAccessKey: 'Test Key',
    sessionToken: 'Test Token',
    region: 'east-1',
  };

  const validateConfig = kbProviderBedrockConfigSchema.parse(mockConfig);
  let bedrockSource: BedrockSource;
  let mockAgentRuntimeClient: jest.Mocked<BedrockAgentRuntimeClient>;
  let mockAgentClient: jest.Mocked<BedrockAgentClient>;
  let mockS3Client: jest.Mocked<S3Client>;

  beforeEach(() => {
    bedrockSource = new BedrockSource(validateConfig);
    mockAgentRuntimeClient = bedrockSource[
      'agentRuntimeClient'
    ] as jest.Mocked<BedrockAgentRuntimeClient>;
    mockAgentClient = bedrockSource[
      'agentClient'
    ] as jest.Mocked<BedrockAgentClient>;

    mockS3Client = new S3Client() as jest.Mocked<S3Client>;

    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with the correct config', () => {
      expect(bedrockSource).toBeInstanceOf(BedrockSource);
    });

    it('should throw an error when accessKeyId is missing', () => {
      const mockResponse = new Error('Invalid or missing parameters for Kb Provider');
      expect(() => new BedrockSource(mockInvalidConfig)).toThrowError(mockResponse);
    });
  });

  describe('search', () => {

    const input: SearchInput = {
      knowledgeBaseId: 'kb-123',
      message: 'test',
      maxResults,
      minScore,
    };

    it('should return search results for valid input', async () => {
      const mockSearchResponse = {
        nextToken: 'mockNextToken',
        retrievalResults: [
          {
            content: {
              text: 'Sample text content',
            },
            location: {
              confluenceLocation: {
                url: 'http://confluence.example.com',
              },
              s3Location: {
                uri: 'http://s3.example.com',
              },
              salesForceLocation: {
                url: 'http://salesforce.example.com',
              },
              type: 'web',
              webLocation: {
                url: 'http://web.example.com',
              },
            },
            metadata: {
              'x-amz-bedrock-kb-document-page-number': 7,
              'x-amz-bedrock-kb-source-uri': 's3://example-datasource/some-folder/Example Policy Statement.pdf',
            },
            score: 0.95,
          },
        ],
      };
      (mockAgentRuntimeClient.send as jest.Mock).mockResolvedValue(mockSearchResponse);

      const response = await bedrockSource.search(input);

      expect(response.results).toEqual(
        mockSearchResponse.retrievalResults.map((result) => ({
          content: result.content.text,
          score: result.score,
          citation: {
            label: '(Example Policy Statement.pdf, p. 7): Sample text content',
            knowledgeBaseId: input.knowledgeBaseId,
          },
        }))
      );
    });

    it('should not include results with a score less than minScore', async () => {
      const mockSearchResponse = {
        nextToken: 'mockNextToken',
        retrievalResults: [
          {
            content: {
              text: 'Sample text content',
            },
            location: {
              confluenceLocation: {
                url: 'http://confluence.example.com',
              },
              s3Location: {
                uri: 'http://s3.example.com',
              },
              salesForceLocation: {
                url: 'http://salesforce.example.com',
              },
              type: 'web',
              webLocation: {
                url: 'http://web.example.com',
              },
            },
            metadata: {
              'x-amz-bedrock-kb-document-page-number': 7,
              'x-amz-bedrock-kb-source-uri': 's3://example-datasource/some-folder/Example Policy Statement.pdf',
            },
            score: 0.95,
          },
          {
            content: {
              text: 'More Sample Text Content',
            },
            location: {
              confluenceLocation: {
                url: 'http://confluence.example.com',
              },
              s3Location: {
                uri: 'http://s3.example.com',
              },
              salesForceLocation: {
                url: 'http://salesforce.example.com',
              },
              type: 'web',
              webLocation: {
                url: 'http://web.example.com',
              },
            },
            metadata: {
              'x-amz-bedrock-kb-document-page-number': 9,
              'x-amz-bedrock-kb-source-uri': 's3://example-datasource/some-folder/Example Policy Statement2.pdf',
            },
            score: (minScore - 0.10),
          },
        ],
      };

      (mockAgentRuntimeClient.send as jest.Mock).mockResolvedValue(mockSearchResponse);

      const response = await bedrockSource.search(input);

      expect(response.results).toEqual(
        mockSearchResponse.retrievalResults
          .filter((result) => !input.minScore || (result.score && result.score >= input.minScore))
          .map((result) => ({
            content: result.content.text,
            score: result.score,
            citation: {
              label: `(Example Policy Statement.pdf, p. ${result.metadata['x-amz-bedrock-kb-document-page-number']}): ${result.content.text}`,
              knowledgeBaseId: input.knowledgeBaseId,
            },
          }))
      );
    });

    it('should throw an error if BedrockAgentRuntimeClient.send fails', async () => {
      const mockError = new Error('Mock Error');
      (mockAgentRuntimeClient.send as jest.Mock).mockRejectedValue(mockError);

      await expect(bedrockSource.search(input)).rejects.toThrow(mockError);
    });
  });

  describe('syncKnowledge Base', () => {
    it('should use the BedrockSource config when calling syncKnowledgeBase', async () => {
      const mockIngestionResponse = {
        ingestionJob: {
          knowledgeBaseId: mockConfig.personalDocumentLibraryKnowledgeBaseId,
          dataSourceId: mockConfig.dataSourceId,
          ingestionJobId: 'ingestion-job-id',
          status: 'COMPLETE',
          startedAt: new Date('2024-02-02T00:00:00.000Z'),
          updatedAt: new Date('2024-02-02T00:00:00.000Z'),
        },
      };
      const mockOptionalDescription = 'Optional Description';
      (mockAgentClient.send as jest.Mock).mockResolvedValue(mockIngestionResponse);

      const response = await bedrockSource.syncKnowledgeBase(mockOptionalDescription);
      expect(response).toEqual(mockIngestionResponse);

      expect(StartIngestionJobCommand).toHaveBeenCalledWith({
        knowledgeBaseId: mockConfig.personalDocumentLibraryKnowledgeBaseId,
        dataSourceId: mockConfig.dataSourceId,
        description: mockOptionalDescription,
      });

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should throw an error if BedrockSource is missing necessary configs', async () => {
      const { personalDocumentLibraryKnowledgeBaseId: _PDL, dataSourceId: _dataSource, ...missingSyncConfig } = mockConfig;
      const mockError = new Error('Missing config required to sync knowledge base with S3 data source');

      const invalidBedrockSource = new BedrockSource(missingSyncConfig);

      await expect(invalidBedrockSource.syncKnowledgeBase()).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(mockError.message);
    });

    it('should throw an error if BedrockAgentClient.send fails', async () => {
      const mockError = new Error('Error attempting to sync Bedrock knowledge base');
      (mockAgentClient.send as jest.Mock).mockRejectedValue(mockError);

      await expect(bedrockSource.syncKnowledgeBase()).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(mockError.message, mockError);
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document successfully', async () => {
      const mockDeleteResponse = { $metadata: { httpStatusCode: 204 } };
      (mockS3Client.send as jest.Mock).mockResolvedValue(mockDeleteResponse);

      const syncKnowledgeBaseMock = jest.spyOn(bedrockSource, 'syncKnowledgeBase').mockResolvedValue({
        $metadata: {
          httpStatusCode: 200,
          requestId: 'mock-request-id',
          extendedRequestId: 'mock-extended-request-id',
          cfId: 'mock-cf-id',
        },
        ingestionJob: {
          knowledgeBaseId: mockConfig.personalDocumentLibraryKnowledgeBaseId,
          dataSourceId: mockConfig.dataSourceId,
          ingestionJobId: 'ingestion-job-id',
          status: 'COMPLETE',
          startedAt: new Date('2024-02-02T00:00:00.000Z'),
          updatedAt: new Date('2024-02-02T00:00:00.000Z'),
        },
      });

      const objectKey = 'documents/test-document.txt';
      const result = await bedrockSource.deleteDocument(objectKey);

      expect(result).toBe(true);
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'my-bucket',
        Key: objectKey,
      });
      expect(syncKnowledgeBaseMock).toHaveBeenCalled();
    });

    it('should return false if document deletion is unsuccessful', async () => {
      const mockDeleteResponse = { $metadata: { httpStatusCode: 404 } };
      (mockS3Client.send as jest.Mock).mockResolvedValue(mockDeleteResponse);

      const objectKey = 'documents/test-document.txt';
      const result = await bedrockSource.deleteDocument(objectKey);

      expect(result).toBe(false);
    });

    it('should throw an error if S3 service throws an exception', async () => {
      const mockError = new Error('S3 Error');
      (mockS3Client.send as jest.Mock).mockRejectedValue(mockError);

      const objectKey = 'documents/test-document.txt';

      await expect(bedrockSource.deleteDocument(objectKey)).rejects.toThrow(
        'Error attempting to delete document from S3'
      );
    });

    it('should throw an error if S3 URI is missing from config', async () => {
      const { s3BucketUri: _s3Uri, ...missingS3Config } = mockConfig;
      const invalidBedrockSource = new BedrockSource(missingS3Config);

      await expect(invalidBedrockSource.deleteDocument('some-key')).rejects.toThrow(
        'Error getting S3 configuration'
      );
    });
  });

  describe('getDocumentsMetadata', () => {
    it('should return documents with metadata', async () => {
      const mockHeadObjectResponse = {
        ContentLength: 1024,
        LastModified: new Date('2023-10-01T00:00:00.000Z'),
        ContentType: 'application/pdf',
      };
      (mockS3Client.send as jest.Mock).mockResolvedValue(mockHeadObjectResponse);

      const filePaths = ['documents/test-document.pdf'];
      const result = await bedrockSource.getDocumentsMetadata(filePaths);

      expect(result).toEqual([
        {
          filePath: 'documents/test-document.pdf',
          fileSize: 1024,
          dateUploaded: new Date('2023-10-01T00:00:00.000Z'),
          fileType: 'application/pdf',
        },
      ]);
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'my-bucket',
        Key: 'documents/test-document.pdf',
      });
    });

    it('should throw an error if S3 service throws an exception', async () => {
      const mockError = new Error('S3 Error');
      (mockS3Client.send as jest.Mock).mockRejectedValue(mockError);

      const filePaths = ['documents/test-document.pdf'];

      await expect(bedrockSource.getDocumentsMetadata(filePaths)).rejects.toThrow(
        'Error retrieving document metadata from S3'
      );
    });

    it('should throw an error if S3 URI is missing from config', async () => {
      const { s3BucketUri: _s3Uri, ...missingS3Config } = mockConfig;
      const invalidBedrockSource = new BedrockSource(missingS3Config);

      await expect(invalidBedrockSource.getDocumentsMetadata(['some-key'])).rejects.toThrow(
        'Error getting S3 configuration'
      );
    });
  });

  describe('uploadPersonalDocuments', () => {

    const mockUserId = 'e2be0fb0-c0ac-4dce-ad2d-e88e8f6e4b0f';

    it('should upload a document successfully', async () => {
      const mockUploadResponse: PutObjectCommandOutput = { $metadata: { httpStatusCode: 204 } };
      (mockS3Client.send as jest.Mock).mockResolvedValue(mockUploadResponse);

      // Mock and spy on the syncKnowledgeBase method
      const syncKnowledgeBaseMock = jest.spyOn(bedrockSource, 'syncKnowledgeBase').mockResolvedValue({
        $metadata: {
          httpStatusCode: 200,
          requestId: 'mock-request-id',
          extendedRequestId: 'mock-extended-request-id',
          cfId: 'mock-cf-id',
        },
        ingestionJob: {
          knowledgeBaseId: mockConfig.personalDocumentLibraryKnowledgeBaseId,
          dataSourceId: mockConfig.dataSourceId,
          ingestionJobId: 'ingestion-job-id',
          status: 'COMPLETE',
          startedAt: new Date('2024-02-02T00:00:00.000Z'),
          updatedAt: new Date('2024-02-02T00:00:00.000Z'),
        },
      });

      const mockDocuments: UserDocument[] = [{
        key: 'someFile.txt',
        contentType: 'text/plain',
        body: 'Some Content Body',
      }];

      const result = await bedrockSource.uploadPersonalDocuments(mockDocuments, mockUserId);

      expect(result).toStrictEqual([{ $metadata: { httpStatusCode: 204 } }]);
      await Promise.all(mockDocuments.map(async (document) => {
        expect(PutObjectCommand).toHaveBeenCalledWith({
          Body: document.body,
          Bucket: 'my-bucket',
          ContentType: document.contentType,
          Key: `${mockUserId}/${document.key}`,
          Metadata: {
            userId: mockUserId,
          },
        });
      }));
      expect(syncKnowledgeBaseMock).toHaveBeenCalled();
    });

    it('should upload many documents successfully', async () => {
      const mockUploadResponse: PutObjectCommandOutput = { $metadata: { httpStatusCode: 204 } };
      (mockS3Client.send as jest.Mock).mockResolvedValue(mockUploadResponse);

      // Mock and spy on the syncKnowledgeBase method
      const syncKnowledgeBaseMock = jest.spyOn(bedrockSource, 'syncKnowledgeBase').mockResolvedValue({
        $metadata: {
          httpStatusCode: 200,
          requestId: 'mock-request-id',
          extendedRequestId: 'mock-extended-request-id',
          cfId: 'mock-cf-id',
        },
        ingestionJob: {
          knowledgeBaseId: mockConfig.personalDocumentLibraryKnowledgeBaseId,
          dataSourceId: mockConfig.dataSourceId,
          ingestionJobId: 'ingestion-job-id',
          status: 'COMPLETE',
          startedAt: new Date('2024-02-02T00:00:00.000Z'),
          updatedAt: new Date('2024-02-02T00:00:00.000Z'),
        },
      });

      const mockDocuments: UserDocument[] = [
        {
          key: 'someFile.txt',
          contentType: 'text/plain',
          body: 'Some Content Body',
        },
        {
          key: 'someFile.txt',
          contentType: 'application/pdf',
          body: 'Some Content Body',
        },
      ];

      const results = await bedrockSource.uploadPersonalDocuments(mockDocuments, mockUserId);

      results.map(result => {
        expect(result).toStrictEqual({ $metadata: { httpStatusCode: 204 } });
      });
      await Promise.all(mockDocuments.map(async (document) => {
        expect(PutObjectCommand).toHaveBeenCalledWith({
          Body: document.body,
          Bucket: 'my-bucket',
          ContentType: document.contentType,
          Key: `${mockUserId}/${document.key}`,
          Metadata: {
            userId: mockUserId,
          },
        });
      }));
      expect(PutObjectCommand).toHaveBeenCalledTimes(2);
      expect(syncKnowledgeBaseMock).toHaveBeenCalled();
    });

    it('should throw an error if S3 URI is missing from config when calling uploadPersonalDocuments', async () => {
      const { s3BucketUri: _s3Uri, ...missingS3Config } = mockConfig;
      const invalidBedrockSource = new BedrockSource(missingS3Config);

      const mockDocuments: UserDocument[] = [{
        key: 'user/someFile.txt',
        contentType: 'text/plain',
        body: 'Some Content Body',
      }];
      await expect(invalidBedrockSource.uploadPersonalDocuments(mockDocuments, mockUserId)).rejects.toThrow(
        'Error getting S3 configuration'
      );
    });

    it('should return false if document upload is unsuccessful', async () => {
      const mockUploadResponse = { $metadata: { httpStatusCode: 404 } };
      (mockS3Client.send as jest.Mock).mockResolvedValue(mockUploadResponse);

      const mockDocuments: UserDocument[] = [{
        key: 'user/someFile.txt',
        contentType: 'text/plain',
        body: 'Some Content Body',
      }];

      const result = await bedrockSource.uploadPersonalDocuments(mockDocuments, mockUserId);

      expect(result).toStrictEqual([{ '$metadata': { 'httpStatusCode': 404 } }]);
    });

    it('should throw an error if S3 service throws an exception when calling uploadPersonalDocuments', async () => {
      const mockError = new Error('S3 Error');
      (mockS3Client.send as jest.Mock).mockRejectedValue(mockError);

      const mockDocuments: UserDocument[] = [{
        key: 'user/someFile.txt',
        contentType: 'text/plain',
        body: 'Some Content Body',
      }];

      await expect(bedrockSource.uploadPersonalDocuments(mockDocuments, mockUserId)).rejects.toThrow(
        'Error attempting to upload document to S3',
      );
    });
  });
});
