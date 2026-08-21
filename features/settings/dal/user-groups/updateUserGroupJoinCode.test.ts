import updateUserGroupJoinCode from './updateUserGroupJoinCode';
import logger from '@/server/logger';
import db from '@/server/db';

// Mock dependencies
jest.mock('@/server/logger');
jest.mock('@/server/db', () => ({
  userGroup: {
    update: jest.fn(),
  },
}));

describe('updateUserGroupJoinCode', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update user group join code successfully', async () => {
    // Mock data
    const mockInput = {
      id: 'group-123',
      joinCode: 'NEW-CODE-123',
    };

    const mockDbResult = {
      id: 'group-123',
      label: 'Test Group',
      joinCode: 'NEW-CODE-123',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      _count: {
        userGroupMemberships: 5,
      },
    };

    // Setup mock implementation
    (db.userGroup.update as jest.Mock).mockResolvedValue(mockDbResult);

    // Execute function
    const result = await updateUserGroupJoinCode(mockInput);

    // Assertions
    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: mockInput.id },
      data: { joinCode: mockInput.joinCode },
      include: {
        _count: {
          select: { userGroupMemberships: true },
        },
      },
    });

    expect(result).toEqual({
      id: 'group-123',
      label: 'Test Group',
      joinCode: 'NEW-CODE-123',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      memberCount: 5,
    });
  });

  it('should throw an error when user group is not found', async () => {
    // Mock data
    const mockInput = {
      id: 'non-existent-group',
      joinCode: 'NEW-CODE-123',
    };

    // Setup mock implementation - return null to simulate not found
    (db.userGroup.update as jest.Mock).mockResolvedValue(null);

    // Execute function and expect it to throw
    await expect(updateUserGroupJoinCode(mockInput)).rejects.toThrow('User Group could not be found.');

    // Verify logger was called with warning
    expect(logger.warn).toHaveBeenCalledWith(`User Group could not be found: ${mockInput.id}`);
  });

  it('should propagate database errors', async () => {
    // Mock data
    const mockInput = {
      id: 'group-123',
      joinCode: 'NEW-CODE-123',
    };

    // Setup mock implementation to throw a database error
    const dbError = new Error('Database connection failed');
    (db.userGroup.update as jest.Mock).mockRejectedValue(dbError);

    // Execute function and expect it to throw the same error
    await expect(updateUserGroupJoinCode(mockInput)).rejects.toThrow(dbError);
  });

  it('should handle empty join code', async () => {
    // Mock data with empty join code
    const mockInput = {
      id: 'group-123',
      joinCode: '',
    };

    const mockDbResult = {
      id: 'group-123',
      label: 'Test Group',
      joinCode: '',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      _count: {
        userGroupMemberships: 3,
      },
    };

    // Setup mock implementation
    (db.userGroup.update as jest.Mock).mockResolvedValue(mockDbResult);

    // Execute function
    const result = await updateUserGroupJoinCode(mockInput);

    // Assertions
    expect(db.userGroup.update).toHaveBeenCalledWith({
      where: { id: mockInput.id },
      data: { joinCode: mockInput.joinCode },
      include: {
        _count: {
          select: { userGroupMemberships: true },
        },
      },
    });

    expect(result).toEqual({
      id: 'group-123',
      label: 'Test Group',
      joinCode: '',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      memberCount: 3,
    });
  });

  it('should update the join code for a group with no members', async () => {
    // Mock data
    const mockInput = {
      id: 'empty-group-123',
      joinCode: 'NEW-EMPTY-CODE',
    };

    const mockDbResult = {
      id: 'empty-group-123',
      label: 'Empty Group',
      joinCode: 'NEW-EMPTY-CODE',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      _count: {
        userGroupMemberships: 0,
      },
    };

    // Setup mock implementation
    (db.userGroup.update as jest.Mock).mockResolvedValue(mockDbResult);

    // Execute function
    const result = await updateUserGroupJoinCode(mockInput);

    // Assertions
    expect(result.memberCount).toBe(0);
    expect(result.joinCode).toBe('NEW-EMPTY-CODE');
  });
});
