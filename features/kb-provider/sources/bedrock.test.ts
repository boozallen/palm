import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';

import { BedrockSource, SearchInput } from '@/features/kb-provider/sources';
import { kbProviderBedrockConfigSchema } from '@/features/shared/types';
import { maxResults, minScore } from '@/features/shared/utils/kbProvider';

jest.mock('@aws-sdk/client-bedrock-agent-runtime');

describe('BedrockSource', () => {
  const mockConfig = {
    accessKeyId: '60c410be-11b0-4b78-ad85-dceeeb0701cd',
    secretAccessKey: 'Test Key',
    sessionToken: 'Test Token',
    region: 'east-1',
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

  beforeEach(() => {
    bedrockSource = new BedrockSource(validateConfig);
    mockAgentRuntimeClient = bedrockSource[
      'agentRuntimeClient'
    ] as jest.Mocked<BedrockAgentRuntimeClient>;

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
});
