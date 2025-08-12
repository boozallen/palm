import db from '@/server/db';
import logger from '@/server/logger';
import { KbProvider, kbProviderConfigSchema } from '@/features/shared/types';
import getKnowledgeBaseAndProvider from './getKnowledgeBaseAndProvider';

jest.mock('@/server/db', () => ({
  knowledgeBase: {
    findUnique: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('getKnowledgeBaseAndProvider', () => {
  const kbid = 'test-kbid';
  const mockKnowledgeBase = {
    id: kbid,
    label: 'Test Knowledge Base',
    externalId: 'test-external-id',
    kbProviderId: 'test-provider-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockProviderConfig = { apiKey: 'some-key', apiEndpoint: 'http://example.com' };
  const mockInvalidProviderConfig = { someKey: 'some value' };
  const mockKbProvider = { id: 'provider-id', config: mockProviderConfig } as KbProvider;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return knowledge base and provider when found', async () => {
    (db.knowledgeBase.findUnique as jest.Mock).mockResolvedValue({
      kbProvider: mockKbProvider,
      ...mockKnowledgeBase,
    });

    const result = await getKnowledgeBaseAndProvider(kbid);

    expect(result).toEqual({
      knowledgeBase: mockKnowledgeBase,
      kbProvider: mockKbProvider,
    });
    expect(db.knowledgeBase.findUnique).toHaveBeenCalledWith({
      where: { id: kbid, deletedAt: null },
      include: { kbProvider: true },
    });
  });

  it('should log an error and throw when knowledge base is not found', async () => {
    const error = 'Not found';
    (db.knowledgeBase.findUnique as jest.Mock).mockRejectedValue(error);

    await expect(getKnowledgeBaseAndProvider(kbid)).rejects.toThrow(`Error fetching knowledge base ${kbid}`);
    expect(logger.error).toHaveBeenCalledWith(`Error fetching knowledge base ${kbid}`, error);
  });

  it('should log an error and throw when kbProvider config is invalid', async () => {
    const error = await (async () => kbProviderConfigSchema.parse(mockInvalidProviderConfig))().catch(e => e);
    (db.knowledgeBase.findUnique as jest.Mock).mockResolvedValue({
      kbProvider: { ...mockKbProvider, config: mockInvalidProviderConfig },
      ...mockKnowledgeBase,
    });

    await expect(getKnowledgeBaseAndProvider(kbid)).rejects.toThrow(`Error fetching knowledge base ${kbid}`);
    expect(logger.error).toHaveBeenCalledWith(`Error fetching knowledge base ${kbid}`, error);
  });
});

