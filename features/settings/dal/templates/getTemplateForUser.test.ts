import getTemplateForUser from './getTemplateForUser';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  userGroupMembership: {
    findFirst: jest.fn(),
  },
}));

const mockUserId = '00000000-0000-0000-0000-000000000001';
const mockFileBytes = Buffer.from('pptx-bytes');

describe('getTemplateForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns template bytes when a matching template is found', async () => {
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userGroup: {
        artifactTemplates: [{ fileData: mockFileBytes }],
      },
    });

    const result = await getTemplateForUser(mockUserId, 'pptx');

    expect(db.userGroupMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: mockUserId },
      select: {
        userGroup: {
          select: {
            artifactTemplates: {
              where: { OR: [{ filename: { endsWith: '.pptx' } }, { filename: { endsWith: '.potx' } }] },
              select: { fileData: true },
              take: 1,
            },
          },
        },
      },
    });

    expect(result).toEqual(mockFileBytes);
  });

  it('returns null when no membership is found', async () => {
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getTemplateForUser(mockUserId, 'pptx');

    expect(result).toBeNull();
  });

  it('returns null when user group has no matching templates', async () => {
    (db.userGroupMembership.findFirst as jest.Mock).mockResolvedValue({
      userGroup: {
        artifactTemplates: [],
      },
    });

    const result = await getTemplateForUser(mockUserId, 'pptx');

    expect(result).toBeNull();
  });

  it('throws and logs when the DB query fails', async () => {
    const dbError = new Error('DB failure');
    (db.userGroupMembership.findFirst as jest.Mock).mockRejectedValue(dbError);

    await expect(getTemplateForUser(mockUserId, 'pptx')).rejects.toThrow('Error getting template for user');
    expect(logger.error).toHaveBeenCalledWith('Error getting template for user', dbError);
  });
});
