import db from '@/server/db';
import logger from '@/server/logger';
import getKbProvider from './getKbProvider';
import { KbProvider, KbProviderType } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  kbProvider: {
    findUnique: jest.fn(),
  },
}));

describe('getKbProvider', () => {
  const mockKbProvider: KbProvider = {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    kbProviderType: KbProviderType.KbProviderPalm,
    label: 'mockLabel',
    config: { apiKey: '123', apiEndpoint: 'https://www.endpoint.com' },
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    updatedAt: new Date('2024-04-04T00:00:00.000Z'),
  };

  const mockError = 'Error fetching knowledge base provider';
  const mockNotFoundError = new Error('Knowledge base provider not found');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch the KB provider by its id', async () => {
    (db.kbProvider.findUnique as jest.Mock).mockResolvedValue(mockKbProvider);

    const response = await getKbProvider(mockKbProvider.id);
    expect(response).toEqual(mockKbProvider);

    expect(db.kbProvider.findUnique).toHaveBeenCalledWith({
      where: { id: mockKbProvider.id, deletedAt: null },
    });

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should throw an error if the KB provider is not found', async () => {
    (db.kbProvider.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getKbProvider(mockKbProvider.id)).rejects.toThrow(mockNotFoundError);

    expect(logger.warn).toHaveBeenCalledWith('Knowledge base provider not found');
  });

  it('should throw an error if the operation fails', async () => {
    const rejectError = new Error('Problem fetching the KB provider');
    (db.kbProvider.findUnique as jest.Mock).mockRejectedValue(rejectError);

    await expect(getKbProvider(mockKbProvider.id)).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching knowledge base provider',
      rejectError,
    );
  });

  it('should throw an error if the config parse fails', async () => {
    const invalidConfigKbProvider = {
      ...mockKbProvider,
      config: { invalidKey: 'invalidValue' },
    };
    (db.kbProvider.findUnique as jest.Mock).mockResolvedValue(invalidConfigKbProvider);

    await expect(getKbProvider(mockKbProvider.id)).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith(
      'Knowledge base provider config is invalid',
      expect.anything(),
    );
  });
});
