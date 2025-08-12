import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { PalmKbApiSource } from './palm-kb-api';
import { KbProviderPalmConfigSchema } from '@/features/shared/types';
import { SearchInput } from '@/features/kb-provider/sources/types';
import { maxResults } from '@/features/shared/utils/kbProvider';

const mock = new MockAdapter(axios);

describe('PalmKbApiSource', () => {
  const config = {
    apiEndpoint: 'https://api.example.com',
    apiKey: 'test-api-key',
  };

  const validConfig = KbProviderPalmConfigSchema.parse(config);

  const searchInput: SearchInput = {
    knowledgeBaseId: 'test-kb-id',
    message: 'test-query',
    maxResults,
  };

  const searchResponse = {
    totalResults: 1,
    results: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        content: 'Test content',
        score: 0.42,
        citation: {
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          name: 'test content citation',
          filename: 'test-content-citation',
        },
      },
    ],
  };

  const expectedResponse = {
    results: [
      {
        content: 'Test content',
        score: 0.42,
        citation: {
          knowledgeBaseId: 'test-kb-id',
          label: 'test content citation',
        },
      },
    ],
  };

  let apiSource: PalmKbApiSource;

  beforeEach(() => {
    apiSource = new PalmKbApiSource(validConfig);
    mock.reset();
  });

  it('should return search results when the API call is successful', async () => {
    mock.onGet(`${config.apiEndpoint}/api/v1/knowledgebases/${searchInput.knowledgeBaseId}/search`).reply(200, searchResponse);

    const result = await apiSource.search(searchInput);

    expect(result).toEqual(expectedResponse);
  });

  it('should throw an error when the API call fails', async () => {
    mock.onGet(`${config.apiEndpoint}/api/v1/knowledgebases/${searchInput.knowledgeBaseId}/search`).reply(500);

    await expect(apiSource.search(searchInput)).rejects.toThrow();
  });

  it('should throw an error when the response schema validation fails', async () => {
    const invalidResponse = {
      totalResults: 1,
      results: [
        {
          id: 'invalid-uuid',
          content: 'Test content',
          links: {
            self: 'https://api.example.com/resource/invalid-uuid',
          },
        },
      ],
    };

    mock.onGet(`${config.apiEndpoint}/api/v1/knowledgebases/${searchInput.knowledgeBaseId}/search`).reply(200, invalidResponse);

    await expect(apiSource.search(searchInput)).rejects.toThrow();
  });
});
