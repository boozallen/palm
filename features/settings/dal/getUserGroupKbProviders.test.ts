import db from '@/server/db';
import logger from '@/server/logger';
import { KbProviderType } from '@/features/shared/types';
import getUserGroupKbProviders from '@/features/settings/dal/getUserGroupKbProviders';

jest.mock('@/server/db', () => ({
  kbProvider: {
    findMany: jest.fn(),
  },
}));

describe('getUserGroupKbProvider', () => {
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';

  const mockResolveValue = [
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
      kbProviderType: KbProviderType.KbProviderPalm,
      label: 'mockLabel',
      config: { apiKey: '123', apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
  ];

  const mockError = 'Error fetching user group knowledge base providers';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch the KB providers by user group Id', async () => {
    (db.kbProvider.findMany as jest.Mock).mockResolvedValue(mockResolveValue);

    const response = await getUserGroupKbProviders(mockUserGroupId);
    expect(response).toEqual(mockResolveValue);

    expect(db.kbProvider.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        userGroups: {
          some: {
            id: mockUserGroupId,
          },
        },
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should return an empty array if the KB provider is not found', async () => {
    (db.kbProvider.findMany as jest.Mock).mockResolvedValue([]);

    await expect(getUserGroupKbProviders(mockUserGroupId)).resolves.toEqual([]);

    expect(logger.warn).toHaveBeenCalledWith(
      'No knowledge base providers for user group'
    );
  });

  it('should throw an error if the operation fails', async () => {
    const rejectError = new Error('Problem fetching the KB providers');
    (db.kbProvider.findMany as jest.Mock).mockRejectedValue(rejectError);

    await expect(getUserGroupKbProviders(mockUserGroupId)).rejects.toThrow(
      mockError
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching user group knowledge base providers',
      rejectError
    );
  });

  it('should throw an error if the config parse fails', async () => {
    const invalidConfigKbProvider = mockResolveValue.map((provider) => {
      if (provider.id === '10e0eba0-b782-491b-b609-b5c84cb0e17a') {
        return { ...provider, config: 'invalidConfig' as any };
      }
      return provider;
    });

    (db.kbProvider.findMany as jest.Mock).mockResolvedValue(
      invalidConfigKbProvider
    );

    await expect(getUserGroupKbProviders(mockUserGroupId)).rejects.toThrow(
      mockError
    );

    expect(logger.error).toHaveBeenCalledWith(
      'User group Knowledge base providers config is invalid',
      expect.objectContaining({
        name: 'ZodError',
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'invalid_union',
            message: 'Invalid input',
            unionErrors: expect.anything(),
          }),
        ]),
      })
    );
  });
});
