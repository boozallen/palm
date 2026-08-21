import db from '@/server/db';
import logger from '@/server/logger';
import { AiProviderType } from '@/features/shared/types';
import getUserGroupAiProviders from '@/features/settings/dal/user-groups/getUserGroupAiProviders';
import buildProvider from '@/features/shared/dal/buildProvider';

jest.mock('@/server/db', () => ({
  userGroup: {
    findUniqueOrThrow: jest.fn(),
  },
}));

jest.mock('features/shared/dal/buildProvider.ts');
describe('getUserGroupAiProviders', () => {
  const mockResolveValue = {
    aiProviders: [
      {
        id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
        label: 'Ai Provider 1',
        config: {
          id: '6b54ffcd-c884-45c9-aa6e-57347f4cc112',
          type: AiProviderType.OpenAi,
          apiKey: 'testKey',
          orgKey: 'testKey',
        },
        configTypeId: 1,
        typeId: 1,
        costPerInputToken: 500,
        costPerOutputToken: 100,
        createdAt: new Date('2021-09-01T00:00:00.000Z'),
        updatedAt: new Date('2021-09-01T00:00:00.000Z'),
      },
    ],
  };

  const mockReturnedValue = {
    id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
    label: 'Ai Provider 1',
    config: {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc112',
      type: AiProviderType.OpenAi,
      apiKey: 'testKey',
      orgKey: 'testKey',
    },
    configTypeId: 1,
    typeId: 1,
    costPerInputToken: 500,
    costPerOutputToken: 100,
    createdAt: new Date('2021-09-01T00:00:00.000Z'),
    updatedAt: new Date('2021-09-01T00:00:00.000Z'),
  };
  const mockGroupId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all the userGroup ai providers', async () => {
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      mockResolveValue
    );

    (buildProvider as jest.Mock).mockResolvedValue(mockReturnedValue);

    await expect(getUserGroupAiProviders(mockGroupId)).resolves.toEqual([
      mockReturnedValue,
    ]);
    expect(db.userGroup.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: mockGroupId,
      },
      select: {
        aiProviders: true,
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw an error if the query fails', async () => {
    const mockUserGroupError = new Error('User Group record not found');
    const mockError =
      'Error getting user group AI providers';
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockRejectedValue(
      mockUserGroupError
    );
    await expect(getUserGroupAiProviders(mockGroupId)).rejects.toThrow(
      mockError
    );
    expect(logger.error).toHaveBeenCalledWith(mockError, mockUserGroupError);
  });
});
