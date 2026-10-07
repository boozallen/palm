import db from '@/server/db';
import createUserGroup from '@/features/settings/dal/user-groups/createUserGroup';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const mockExecuteRaw = jest.fn();
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
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
  mockExecuteRaw.mockReset();
  mockFindFirst.mockReset();
  mockCreate.mockReset();
  (db.$transaction as jest.Mock).mockImplementation(async (callback) => callback({
    $executeRaw: mockExecuteRaw,
    userGroup: { findFirst: mockFindFirst, create: mockCreate },
  }));
});
describe('addUserGroup', () => {
  it('should create the user group record', async () => {
    mockCreate.mockResolvedValue(mockResolvedValue);

    const response = await createUserGroup({
      label: mockResolvedValue.label,
    });

    expect(response).toEqual(mockResolvedValue);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        label: {
          equals: mockInput.label,
          mode: 'insensitive',
        },
      },
    });
    expect(mockCreate).toHaveBeenCalledWith({
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

    mockCreate.mockRejectedValue(
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

    expect(mockCreate).toHaveBeenCalledWith({
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

    mockCreate.mockRejectedValue(
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

    mockFindFirst.mockResolvedValue({
      id: 'some-existing-id',
      label: mockInput.label,
      memberCount: 10,
    });

    await expect(
      createUserGroup({
        label: mockInput.label,
      })
    ).rejects.toThrow('A user group with that name already exists');

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        label: {
          equals: mockInput.label,
          mode: 'insensitive',
        },
      },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // Label has no DB-level uniqueness, so the advisory lock is the only thing
  // serializing two concurrent creates for the same name against each other.
  it('takes an advisory lock scoped to the label before checking for a duplicate', async () => {
    mockCreate.mockResolvedValue(mockResolvedValue);

    await createUserGroup({ label: mockResolvedValue.label });

    expect(mockExecuteRaw).toHaveBeenCalled();
    const lockCallOrder = mockExecuteRaw.mock.invocationCallOrder[0];
    const findFirstCallOrder = mockFindFirst.mock.invocationCallOrder[0];
    expect(lockCallOrder).toBeLessThan(findFirstCallOrder);
  });
});
