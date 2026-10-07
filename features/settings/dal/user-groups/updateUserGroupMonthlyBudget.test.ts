import db from '@/server/db';

import updateUserGroupMonthlyBudget from './updateUserGroupMonthlyBudget';

jest.mock('@/server/db', () => ({
  userGroup: {
    update: jest.fn(),
  },
}));

describe('updateUserGroupMonthlyBudget DAL', () => {
  const mockUserGroupId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const mockUpdatedUserGroup = {
    id: mockUserGroupId,
    label: 'Test Group',
    monthlyBudget: 500,
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update the user group monthly budget', async () => {
    (db.userGroup.update as jest.Mock).mockResolvedValue(mockUpdatedUserGroup);

    const input = {
      userGroupId: mockUserGroupId,
      monthlyBudget: 500,
    };

    const result = await updateUserGroupMonthlyBudget(input);

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: {
        id: mockUserGroupId,
        deletedAt: null,
      },
      data: {
        monthlyBudget: 500,
      },
      select: {
        id: true,
        label: true,
        monthlyBudget: true,
        updatedAt: true,
      },
    });

    expect(result).toEqual(mockUpdatedUserGroup);
  });

  it('should clear the user group monthly budget when set to null', async () => {
    const clearedUserGroup = {
      ...mockUpdatedUserGroup,
      monthlyBudget: null,
    };

    (db.userGroup.update as jest.Mock).mockResolvedValue(clearedUserGroup);

    const input = {
      userGroupId: mockUserGroupId,
      monthlyBudget: null,
    };

    const result = await updateUserGroupMonthlyBudget(input);

    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: {
        id: mockUserGroupId,
        deletedAt: null,
      },
      data: {
        monthlyBudget: null,
      },
      select: {
        id: true,
        label: true,
        monthlyBudget: true,
        updatedAt: true,
      },
    });

    expect(result).toEqual(clearedUserGroup);
  });

  it('should handle database errors gracefully', async () => {
    const dbError = new Error('Database connection failed');
    (db.userGroup.update as jest.Mock).mockRejectedValue(dbError);

    const input = {
      userGroupId: mockUserGroupId,
      monthlyBudget: 500,
    };

    await expect(updateUserGroupMonthlyBudget(input)).rejects.toThrow('Database connection failed');
  });
});
