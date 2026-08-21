import db from '@/server/db';

import updateUserGroupWorkflows from './updateUserGroupWorkflows';

jest.mock('@/server/db', () => ({
  userGroup: {
    update: jest.fn(),
  },
}));

describe('updateUserGroupWorkflows DAL', () => {
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockUpdatedUserGroup = {
    id: mockUserGroupId,
    label: 'Test Group',
    workflowsEnabled: true,
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update user group workflows to enabled', async () => {
    (db.userGroup.update as jest.Mock).mockResolvedValue(mockUpdatedUserGroup);

    const input = {
      userGroupId: mockUserGroupId,
      workflowsEnabled: true,
    };

    const result = await updateUserGroupWorkflows(input);

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: {
        id: mockUserGroupId,
      },
      data: {
        workflowsEnabled: true,
      },
      select: {
        id: true,
        label: true,
        workflowsEnabled: true,
        updatedAt: true,
      },
    });

    expect(result).toEqual(mockUpdatedUserGroup);
  });

  it('should update user group workflows to disabled', async () => {
    const disabledUserGroup = {
      ...mockUpdatedUserGroup,
      workflowsEnabled: false,
    };

    (db.userGroup.update as jest.Mock).mockResolvedValue(disabledUserGroup);

    const input = {
      userGroupId: mockUserGroupId,
      workflowsEnabled: false,
    };

    const result = await updateUserGroupWorkflows(input);

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: {
        id: mockUserGroupId,
      },
      data: {
        workflowsEnabled: false,
      },
      select: {
        id: true,
        label: true,
        workflowsEnabled: true,
        updatedAt: true,
      },
    });

    expect(result).toEqual(disabledUserGroup);
  });

  it('should handle database errors gracefully', async () => {
    const dbError = new Error('Database connection failed');
    (db.userGroup.update as jest.Mock).mockRejectedValue(dbError);

    const input = {
      userGroupId: mockUserGroupId,
      workflowsEnabled: true,
    };

    await expect(updateUserGroupWorkflows(input)).rejects.toThrow('Database connection failed');

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: {
        id: mockUserGroupId,
      },
      data: {
        workflowsEnabled: true,
      },
      select: {
        id: true,
        label: true,
        workflowsEnabled: true,
        updatedAt: true,
      },
    });
  });
});
