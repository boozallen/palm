import db from '@/server/db';
import createUserGroup from '@/features/settings/dal/createUserGroup';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

jest.mock('@/server/db', () => ({
  userGroup: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

const mockInput = {
  label: 'New User Group',
};

const mockResolvedValue = {
  id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
  label: mockInput.label,
  createdAt: '2021-07-13T12:34:56.000Z',
  updatedAt: '2021-07-13T12:34:56.000Z',
  memberCount: 0,
};

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
  (db.userGroup.findFirst as jest.Mock).mockReset();
  (db.userGroup.create as jest.Mock).mockReset();
});
describe('addUserGroup', () => {
  it('should create the user group record', async () => {
    (db.userGroup.create as jest.Mock).mockResolvedValue(mockResolvedValue);

    const response = await createUserGroup({
      label: mockResolvedValue.label,
    });

    expect(response).toEqual(mockResolvedValue);
    expect(db.userGroup.findFirst).toHaveBeenCalledWith({
      where: {
        label: {
          equals: mockInput.label,
          mode: 'insensitive',
        },
      },
    });
    expect(db.userGroup.create).toHaveBeenCalledWith({
      data: {
        label: mockResolvedValue.label,
      },
    });
  });

  it('throws Error with sanitized Prisma error message for known Prisma errors', async () => {
    const mockPrismaError = new PrismaClientKnownRequestError(
      'Database query execution error',
      {
        code: 'P2010',
        clientVersion: '4.0.0',
      }
    );

    (db.userGroup.create as jest.Mock).mockRejectedValue(
      mockPrismaError
    );

    (handlePrismaError as jest.Mock).mockReturnValue(
      'Database query execution error'
    );

    await expect(
      createUserGroup({
        label: mockResolvedValue.label,
      })
    ).rejects.toThrow('Database query execution error');

    expect(db.userGroup.create).toHaveBeenCalledWith({
      data: {
        label: mockResolvedValue.label,
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Error creating user group', mockPrismaError
    );
    expect(handlePrismaError).toHaveBeenCalledWith(mockPrismaError);
  });

  it('throws generic Error for unknown Prisma error', async () => {
    const mockUnknownPrismaError = new PrismaClientKnownRequestError(
      'Unknown error',
      {
        code: 'P9999',
        clientVersion: '4.0.0',
      }
    );

    (db.userGroup.create as jest.Mock).mockRejectedValue(
      mockUnknownPrismaError
    );

    (handlePrismaError as jest.Mock).mockReturnValue(
      'An unexpected database error occurred'
    );

    await expect(createUserGroup({
      label: mockResolvedValue.label,
    })).rejects.toThrow(
      'An unexpected database error occurred'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error creating user group',
      mockUnknownPrismaError
    );

    expect(handlePrismaError).toHaveBeenCalledWith(mockUnknownPrismaError);
  });

  it('prevents creation of user group with duplicate label', async () => {

    (db.userGroup.findFirst as jest.Mock).mockResolvedValue({
      id: 'some-existing-id',
      label: mockInput.label,
      memberCount: 10,
    });

    await expect(
      createUserGroup({
        label: mockInput.label,
      })
    ).rejects.toThrow('A user group with that name already exists');

    expect(db.userGroup.findFirst).toHaveBeenCalledWith({
      where: {
        label: {
          equals: mockInput.label,
          mode: 'insensitive',
        },
      },
    });
    expect(db.userGroup.create).not.toHaveBeenCalled();
  });
});
