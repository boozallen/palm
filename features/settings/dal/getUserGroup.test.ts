import db from '@/server/db';
import logger from '@/server/logger';
import getUserGroup from './getUserGroup';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  userGroup: {
    findUniqueOrThrow: jest.fn(),
  },
}));

describe('getUserGroup DAL', () => {

  const mockResolve = {
    id: '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18',
    label: 'mockUserGroup',
    joinCode: 'ABC12345',
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    _count: { userGroupMemberships: 1 },
  };
  const mockUserGroup = {
    id: '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18',
    label: 'mockUserGroup',
    joinCode: 'ABC12345',
    createdAt: new Date('2024-02-02T00:00:00.000Z'),
    updatedAt: new Date('2024-04-04T00:00:00.000Z'),
    memberCount: 1,
  };
  const mockError = 'Error getting user group';
  const mockUserGroupNotFoundError = new PrismaClientKnownRequestError('Requested User record not found', { code: 'P2025', clientVersion: '5.5.2' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch the user group by it\'s id', async () => {
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockResolvedValue(mockResolve);

    const response = await getUserGroup(mockUserGroup.id);
    expect(response).toEqual(mockUserGroup);

    expect(db.userGroup.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: mockUserGroup.id },
      include: {
        _count: {
          select: { userGroupMemberships: true },
        },
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should handle a user group with a null joinCode', async () => {
    const mockResolveWithNullJoinCode = {
      ...mockResolve,
      joinCode: null,
    };
    const expectedUserGroupWithNullJoinCode = {
      ...mockUserGroup,
      joinCode: null,
    };

    (db.userGroup.findUniqueOrThrow as jest.Mock).mockResolvedValue(mockResolveWithNullJoinCode);

    const response = await getUserGroup(mockUserGroup.id);
    expect(response).toEqual(expectedUserGroupWithNullJoinCode);

    expect(db.userGroup.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: mockUserGroup.id },
      include: {
        _count: {
          select: { userGroupMemberships: true },
        },
      },
    });

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw an error if the user group is not found', async () => {
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockRejectedValue(mockUserGroupNotFoundError);

    await expect(getUserGroup(mockUserGroup.id)).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith(
      mockError,
      mockUserGroupNotFoundError
    );
  });

  it('should throw an error if the operation fails', async () => {
    const rejectError = new Error('Problem fetching the user group');
    (db.userGroup.findUniqueOrThrow as jest.Mock).mockRejectedValue(rejectError);

    await expect(getUserGroup(mockUserGroup.id)).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith(
      mockError,
      rejectError,
    );
  });

});
