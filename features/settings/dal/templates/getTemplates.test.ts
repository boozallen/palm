import getTemplates from './getTemplates';
import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

jest.mock('@/server/db', () => ({
  artifactTemplate: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

const mockTemplates = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    filename: 'sample-template.pptx',
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    filename: 'client-template.docx',
    createdAt: new Date('2026-08-09T00:00:00.000Z'),
    updatedAt: new Date('2026-08-09T00:00:00.000Z'),
  },
];

describe('getTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.artifactTemplate.findMany as jest.Mock).mockResolvedValue(mockTemplates);
  });

  it('returns all templates ordered by createdAt desc', async () => {
    const result = await getTemplates();

    expect(db.artifactTemplate.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        filename: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(result).toEqual(mockTemplates);
  });

  it('returns an empty array if no templates exist', async () => {
    (db.artifactTemplate.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getTemplates();
    expect(result).toEqual([]);
  });

  it('throws and logs if the DB query fails', async () => {
    const dbError = new Error('DB failure');
    (db.artifactTemplate.findMany as jest.Mock).mockRejectedValue(dbError);
    (handlePrismaError as jest.Mock).mockReturnValue('DB failure');

    await expect(getTemplates()).rejects.toThrow('DB failure');
    expect(logger.error).toHaveBeenCalledWith('Error fetching templates', dbError);
    expect(handlePrismaError).toHaveBeenCalledWith(dbError);
  });
});
