import updateKbProvider from './updateKbProvider';
import db from '@/server/db';
import {
  KbProviderType,
  KbProvider,
  KbProviderConfig,
} from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

describe('updateKbProvider DAL', () => {
  const kbProviderUuid = '50858dc4-d1c1-4680-ad97-cf2de8d34b8c';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockKbProviderUpdate = jest.fn();
  const mockKbProviderFindUnique = jest.fn();

  (db.$transaction as jest.Mock).mockImplementation(async (prisma) => {
    return prisma({
      kbProvider: {
        findUnique: mockKbProviderFindUnique,
        update: mockKbProviderUpdate,
      },
    });
  });

  describe('Updates KbProvider configurations', () => {
    const kbProviderResultMock: KbProvider = {
      id: kbProviderUuid,
      label: 'Test Provider',
      kbProviderType: KbProviderType.KbProviderPalm,
      writeAccess: false,
      config: {
        apiKey: 'old-api-key',
        apiEndpoint: 'https://old-api.example.com/v1',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockKbProviderFindUnique.mockResolvedValue(kbProviderResultMock);
    });

    it('successfully updates an PALM provider', async () => {
      const inputMock = {
        id: kbProviderUuid,
        label: 'New PALM Label',
        writeAccess: true,
        config: {
          apiKey: 'new-api-key',
          apiEndpoint: 'https://new-api.example.com/v1',
        } as KbProviderConfig,
      };

      const updatedKbProvider: KbProvider = {
        ...kbProviderResultMock,
        label: inputMock.label,
        writeAccess: inputMock.writeAccess,
        config: inputMock.config,
        updatedAt: expect.any(Date),
      };

      mockKbProviderUpdate.mockResolvedValueOnce(updatedKbProvider);

      const result = await updateKbProvider(inputMock);

      expect(mockKbProviderUpdate).toHaveBeenCalledWith({
        where: { id: kbProviderUuid, deletedAt: null },
        data: {
          label: inputMock.label,
          writeAccess: inputMock.writeAccess,
          config: inputMock.config,
        },
      });

      expect(result).toEqual(updatedKbProvider);
    });

    it('throws an error if config validation fails', async () => {
      const inputMock = {
        id: kbProviderUuid,
        label: 'Invalid Config',
        writeAccess: false,
        config: {
          apiKey: 'new-api-key',
          apiEndpoint: '', // Invalid empty string
        } as KbProviderConfig,
      };

      await expect(updateKbProvider(inputMock)).rejects.toThrow();

      expect(mockKbProviderUpdate).not.toHaveBeenCalled();
    });
  });
});
