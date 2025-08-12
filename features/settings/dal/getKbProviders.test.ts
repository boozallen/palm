import db from '@/server/db';
import logger from '@/server/logger';
import { KbProvider, KbProviderType } from '@/features/shared/types';
import getKbProviders from '@/features/settings/dal/getKbProviders';

jest.mock('@/server/db', () => ({
  kbProvider: {
    findMany: jest.fn(),
  },
}));

describe('getKbProviders', () => {
  const mockKbProvider: KbProvider = {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    kbProviderType: KbProviderType.KbProviderPalm,
    label: 'mockLabel',
    config: { apiKey: '123', apiEndpoint: 'https://www.endpoint.com' },
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    updatedAt: new Date('2024-04-04T00:00:00.000Z'),
  };

  const mockError = 'Error fetching knowledge base providers';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch all KB providers', async () => {
    (db.kbProvider.findMany as jest.Mock).mockResolvedValue([mockKbProvider]);

    const response = await getKbProviders();
    expect(response).toEqual([mockKbProvider]);

    expect(db.kbProvider.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw an error if fetching KB providers fails', async () => {
    const rejectError = new Error('Problem fetching the KB providers');
    (db.kbProvider.findMany as jest.Mock).mockRejectedValue(rejectError);

    await expect(getKbProviders()).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching knowledge base providers',
      rejectError,
    );
  });

  it('should throw an error if the config parse fails', async () => {
    const invalidConfigKbProvider = {
      ...mockKbProvider,
      config: { invalidKey: 'invalidValue' },
    };
    (db.kbProvider.findMany as jest.Mock).mockResolvedValue([invalidConfigKbProvider]);

    await expect(getKbProviders()).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith(
      'Knowledge base provider config is invalid',
      expect.anything(),
    );
  });
});
