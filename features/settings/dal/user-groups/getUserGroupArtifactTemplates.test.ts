import db from '@/server/db';
import logger from '@/server/logger';
import getUserGroupArtifactTemplates from '@/features/settings/dal/user-groups/getUserGroupArtifactTemplates';

jest.mock('@/server/db', () => ({
  userGroup: {
    findUniqueOrThrow: jest.fn(),
  },
}));

const mockUserGroupId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';

const mockTemplates = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    filename: 'sample-template.pptx',
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
  },
];

describe('getUserGroupArtifactTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns artifact templates for the user group', async () => {
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      artifactTemplates: mockTemplates,
    });

    const result = await getUserGroupArtifactTemplates(mockUserGroupId);

    expect(db.userGroup.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: mockUserGroupId },
      select: {
        artifactTemplates: {
          select: {
            id: true,
            filename: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    expect(result).toEqual(mockTemplates);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns an empty array when the user group has no templates', async () => {
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      artifactTemplates: [],
    });

    const result = await getUserGroupArtifactTemplates(mockUserGroupId);

    expect(result).toEqual([]);
  });

  it('throws and logs if the query fails', async () => {
    const dbError = new Error('User group not found');
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockRejectedValue(dbError);

    await expect(getUserGroupArtifactTemplates(mockUserGroupId)).rejects.toThrow(
      'Error getting user group artifact templates',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting user group artifact templates',
      dbError,
    );
  });
});
