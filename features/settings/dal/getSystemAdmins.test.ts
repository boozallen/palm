import db from '@/server/db';
import logger from '@/server/logger';
import getSystemAdmins from './getSystemAdmins';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/server/db', () => {
  return {
    user: {
      findMany: jest.fn(),
    },
  };
});

describe('getSystemAdmins', () => {

  const mockSystemAdmins = [
    {
      id: '36bc30d6-667f-41d1-b3ea-2ab8a811f278',
      name: 'John Doe',
      email: 'doe_john@domain.com',
      role: UserRole.Admin,
    },
    {
      id: '7dab787c-36cb-4a7f-926e-27e9bb9ef2fe',
      name: 'Jane Doe',
      email: null,
      role: UserRole.Admin,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (db.user.findMany as jest.Mock).mockResolvedValue(mockSystemAdmins);

  });

  it('should return system admins', async () => {
    await expect(getSystemAdmins()).resolves.toEqual(
      mockSystemAdmins.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      }))
    );
  });

  it('should throw error if db operation fails', async () => {
    const error = new Error('Failed to fetch system admins');
    (db.user.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getSystemAdmins()).rejects.toThrow('Error fetching system admins');
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching system admins', error
    );
  });
});
