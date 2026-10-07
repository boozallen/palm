import { getMetadata } from './getMetadata';
import { AIFactory } from '@/features/ai-provider';

jest.mock('@/server/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('@/features/ai-provider');

const mockCompletion = jest.fn();

function setupFactory() {
  (AIFactory as jest.Mock).mockImplementation(() => ({
    buildSystemSource: jest.fn().mockResolvedValue({
      source: { completion: mockCompletion },
      model: { externalId: 'model-x' },
    }),
  }));
}

const chunks = [
  {
    content: 'Document name: atlas.pdf\n\nStatement of Objectives for ATLAS. Issued 2025-03-01.',
    startPosition: 0,
    endPosition: 50,
    index: 0,
    tokenCount: 10,
  },
  { content: 'Section 2 ...', startPosition: 51, endPosition: 100, index: 1, tokenCount: 10 },
  { content: 'Signed 2025-03-01', startPosition: 101, endPosition: 120, index: 2, tokenCount: 5 },
];

describe('getMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFactory();
  });

  it('returns metadata on a valid response', async () => {
    mockCompletion.mockResolvedValue({
      text: '{"type":"SOO","date":"2025-03-01","summary":"A statement of objectives."}',
    });

    const result = await getMetadata({ documentId: 'doc-1', chunks, userId: 'user-1', fileName: 'atlas.pdf' });

    expect(result).toEqual({
      type: 'SOO',
      date: '2025-03-01',
      summary: 'A statement of objectives.',
    });
  });

  it('returns only summary when type/date are null', async () => {
    mockCompletion.mockResolvedValue({
      text: '{"type":null,"date":null,"summary":"A pancake recipe."}',
    });

    const result = await getMetadata({ documentId: 'doc-2', chunks, userId: 'user-1', fileName: 'pancakes.txt' });

    expect(result).toEqual({ summary: 'A pancake recipe.' });
  });

  it('returns null when JSON is malformed', async () => {
    mockCompletion.mockResolvedValue({ text: 'no json here' });

    const result = await getMetadata({ documentId: 'doc-3', chunks, userId: 'user-1', fileName: 'malformed.pdf' });

    expect(result).toBeNull();
  });

  it('returns null when required properties are missing', async () => {
    mockCompletion.mockResolvedValue({ text: '{"category":"SOO"}' });

    const result = await getMetadata({ documentId: 'doc-missing', chunks, userId: 'user-1', fileName: 'missing.pdf' });

    expect(result).toBeNull();
  });

  it('returns null without throwing when the LLM call fails', async () => {
    mockCompletion.mockRejectedValueOnce(new Error('LLM down'));

    const result = await getMetadata({ documentId: 'doc-4', chunks, userId: 'user-1', fileName: 'error.pdf' });

    expect(result).toBeNull();
  });

  it('returns result when summary is empty', async () => {
    mockCompletion.mockResolvedValue({
      text: '{"type":"Memo","date":null,"summary":""}',
    });

    const result = await getMetadata({ documentId: 'doc-5', chunks, userId: 'user-1', fileName: 'memo.pdf' });

    expect(result).toEqual({ type: 'Memo' });
  });
});
