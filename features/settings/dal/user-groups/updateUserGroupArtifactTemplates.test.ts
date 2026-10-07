import db from '@/server/db';
import logger from '@/server/logger';
import updateUserGroupArtifactTemplates from '@/features/settings/dal/user-groups/updateUserGroupArtifactTemplates';

jest.mock('@/server/db', () => ({
  userGroup: {
    update: jest.fn(),
  },
}));

const mockUserGroupId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';
const mockTemplateId = '00000000-0000-0000-0000-000000000001';

const mockTemplate = {
  id: mockTemplateId,
  filename: 'sample-template.pptx',
  createdAt: new Date('2026-08-10T00:00:00.000Z'),
  updatedAt: new Date('2026-08-10T00:00:00.000Z'),
};

describe('updateUserGroupArtifactTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('connects a template to the user group when enabled is true', async () => {
    (db.userGroup.update as jest.Mock).mockResolvedValue({
      artifactTemplates: [mockTemplate],
    });

    const result = await updateUserGroupArtifactTemplates({
      userGroupId: mockUserGroupId,
      templateId: mockTemplateId,
      enabled: true,
    });

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: mockUserGroupId, deletedAt: null },
      data: {
        artifactTemplates: { connect: { id: mockTemplateId } },
      },
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
    expect(result).toEqual([mockTemplate]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('disconnects a template from the user group when enabled is false', async () => {
    (db.userGroup.update as jest.Mock).mockResolvedValue({
      artifactTemplates: [],
    });

    const result = await updateUserGroupArtifactTemplates({
      userGroupId: mockUserGroupId,
      templateId: mockTemplateId,
      enabled: false,
    });

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: mockUserGroupId, deletedAt: null },
      data: {
        artifactTemplates: { disconnect: { id: mockTemplateId } },
      },
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
    expect(result).toEqual([]);
  });

  it('throws and logs if the update fails', async () => {
    const dbError = new Error('Update failed');
    (db.userGroup.update as jest.Mock).mockRejectedValue(dbError);

    await expect(
      updateUserGroupArtifactTemplates({
        userGroupId: mockUserGroupId,
        templateId: mockTemplateId,
        enabled: true,
      }),
    ).rejects.toThrow('Error updating user group artifact templates');

    expect(logger.error).toHaveBeenCalledWith(
      'Error updating user group artifact templates',
      dbError,
    );
  });
});
