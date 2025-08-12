import db from '@/server/db';
import logger from '@/server/logger';
import updateUserGroupKbProviders from '@/features/settings/dal/updateUserGroupKbProviders';
import { KbProviderType } from '@/features/shared/types';

const updateMock = jest.fn();

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

(db.$transaction as jest.Mock).mockImplementation(
  async (transactionCallback) => {
    return transactionCallback({
      userGroup: {
        update: updateMock,
      },
    });
  }
);

const mockResolveValue = {
  kbProviders: [
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
      kbProviderType: KbProviderType.KbProviderPalm,
      label: 'mockLabel',
      config: { apiKey: '123', apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
    {
      id: '10e0eba0-b782-491b-b609-b5c84cb0e17b',
      kbProviderType: KbProviderType.KbProviderPalm,
      label: 'mockLabel2',
      config: { apiKey: '123', apiEndpoint: 'https://www.endpoint.com' },
      createdAt: new Date('2024-02-02T00:00:00.000Z'),
      updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    },
  ],
};

describe('updateUserGroupKbProviders', () => {
  const mockError = 'Error updating the user group\'s KbProviders';

  beforeEach(() => {
    jest.clearAllMocks();

    updateMock.mockResolvedValue(mockResolveValue);
  });

  it('should connect a kbProvider to a user group when enabled == TRUE', async () => {
    const input = {
      userGroupId: 'd7b0c4eb-d412-4e71-ae11-888ec1919572',
      kbProviderId: 'd7b0c4eb-d412-4e71-ae11-888ec1919575',
      enabled: true,
    };

    const result = await updateUserGroupKbProviders({
      userGroupId: input.userGroupId,
      kbProviderId: input.kbProviderId,
      enabled: input.enabled,
    });

    expect(result).toEqual(mockResolveValue.kbProviders);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: input.userGroupId },
      data: {
        kbProviders: {
          connect: { id: 'd7b0c4eb-d412-4e71-ae11-888ec1919575' },
        },
      },
      select: {
        kbProviders: {
          where: { deletedAt: null },
        },
      },
    });
  });

  it('should disconnect a kbProvider from a user group when enabled == FALSE', async () => {
    const input = {
      userGroupId: 'd7b0c4eb-d412-4e71-ae11-888ec1919572',
      kbProviderId: 'd7b0c4eb-d412-4e71-ae11-888ec1919575',
      enabled: false,
    };

    const result = await updateUserGroupKbProviders({
      userGroupId: input.userGroupId,
      kbProviderId: input.kbProviderId,
      enabled: input.enabled,
    });

    expect(result).toEqual(mockResolveValue.kbProviders);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: input.userGroupId },
      data: {
        kbProviders: {
          disconnect: { id: 'd7b0c4eb-d412-4e71-ae11-888ec1919575' },
        },
      },
      select: {
        kbProviders: {
          where: { deletedAt: null },
        },
      },
    });
  });

  it('should throw an error if the operation fails', async () => {
    const operationFailedError = new Error(
      'Problem updating the user group\'s kbProviders'
    );
    updateMock.mockRejectedValue(operationFailedError);

    const input = {
      userGroupId: 'd7b0c4eb-d412-4e71-ae11-888ec1919572',
      kbProviderId: 'd7b0c4eb-d412-4e71-ae11-888ec1919575',
      enabled: false,
    };

    await expect(updateUserGroupKbProviders(input)).rejects.toThrow(mockError);
    expect(logger.error).toHaveBeenCalledWith(mockError, operationFailedError);
  });

  it('should throw an error if the config parse fails', async () => {
    const mockConfigParseError =
      'User group knowledge base providers config is invalid';
    const invalidConfigKbProvider = mockResolveValue.kbProviders.map(
      (provider) => {
        if (provider.id === '10e0eba0-b782-491b-b609-b5c84cb0e17a') {
          return { ...provider, config: 'invalidConfig' as any };
        }
        return provider;
      }
    );

    updateMock.mockResolvedValue({
      kbProviders: invalidConfigKbProvider,
    });

    const input = {
      userGroupId: 'd7b0c4eb-d412-4e71-ae11-888ec1919572',
      kbProviderId: 'd7b0c4eb-d412-4e71-ae11-888ec1919575',
      enabled: false,
    };

    await expect(
      updateUserGroupKbProviders({
        userGroupId: input.userGroupId,
        kbProviderId: input.kbProviderId,
        enabled: input.enabled,
      })
    ).rejects.toThrow('Error updating the user group\'s KbProviders');

    expect(logger.error).toHaveBeenCalledWith(
      mockConfigParseError,
      expect.anything()
    );
  });
});
