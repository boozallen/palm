import { extractSearchTerms } from './extractSearchTerms';
import { AiRepository } from '@/features/ai-provider/sources/types';

jest.mock('@/server/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const mockSource: Pick<AiRepository, 'chatCompletion'> = {
  chatCompletion: jest.fn(),
};
const mockModel = { externalId: 'test-model' };

describe('extractSearchTerms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns extracted terms from LLM response', async () => {
    (mockSource.chatCompletion as jest.Mock).mockResolvedValue({
      text: '{ "terms": ["John Smith", "ASI"] }',
      inputTokensUsed: 10,
      outputTokensUsed: 5,
    });
    const result = await extractSearchTerms('Who is John Smith and what is ASI?', mockSource as AiRepository, mockModel);
    expect(result.terms).toEqual(['John Smith', 'ASI']);
  });

  it('strips markdown fences from response', async () => {
    (mockSource.chatCompletion as jest.Mock).mockResolvedValue({
      text: '```json\n{ "terms": ["EU AI Act"] }\n```',
      inputTokensUsed: 10,
      outputTokensUsed: 5,
    });
    const result = await extractSearchTerms('query', mockSource as AiRepository, mockModel);
    expect(result.terms).toEqual(['EU AI Act']);
  });

  it('returns empty terms on LLM failure', async () => {
    (mockSource.chatCompletion as jest.Mock).mockRejectedValue(new Error('fail'));
    const result = await extractSearchTerms('query', mockSource as AiRepository, mockModel);
    expect(result.terms).toEqual([]);
  });

  it('returns empty terms when LLM returns invalid JSON', async () => {
    (mockSource.chatCompletion as jest.Mock).mockResolvedValue({
      text: 'not json',
      inputTokensUsed: 10,
      outputTokensUsed: 5,
    });
    const result = await extractSearchTerms('query', mockSource as AiRepository, mockModel);
    expect(result.terms).toEqual([]);
  });

  it('filters out non-string entries from terms array', async () => {
    (mockSource.chatCompletion as jest.Mock).mockResolvedValue({
      text: '{ "terms": ["Valid", 123, null, "Another"] }',
      inputTokensUsed: 10,
      outputTokensUsed: 5,
    });
    const result = await extractSearchTerms('query', mockSource as AiRepository, mockModel);
    expect(result.terms).toEqual(['Valid', 'Another']);
  });

  it('returns empty terms when terms field is missing', async () => {
    (mockSource.chatCompletion as jest.Mock).mockResolvedValue({
      text: '{ "other": "field" }',
      inputTokensUsed: 10,
      outputTokensUsed: 5,
    });
    const result = await extractSearchTerms('query', mockSource as AiRepository, mockModel);
    expect(result.terms).toEqual([]);
  });

  it('handles trailing commas in JSON', async () => {
    (mockSource.chatCompletion as jest.Mock).mockResolvedValue({
      text: '{ "terms": ["ASI", "EU AI Act", ] }',
      inputTokensUsed: 10,
      outputTokensUsed: 5,
    });
    const result = await extractSearchTerms('query', mockSource as AiRepository, mockModel);
    expect(result.terms).toEqual(['ASI', 'EU AI Act']);
  });
});
