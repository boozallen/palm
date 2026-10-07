import deleteTemplate from './deleteTemplate';
import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

jest.mock('@/server/db', () => ({
  artifactTemplate: {
    delete: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

const templateId = '00000000-0000-0000-0000-000000000001';

describe('deleteTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.artifactTemplate.delete as jest.Mock).mockResolvedValue({ id: templateId });
  });

  it('deletes the template and returns its id', async () => {
    const result = await deleteTemplate(templateId);

    expect(db.artifactTemplate.delete).toHaveBeenCalledWith({
      where: { id: templateId },
      select: { id: true },
    });

    expect(result).toEqual({ id: templateId });
  });

  it('throws and logs if the DB query fails', async () => {
    const dbError = new Error('DB failure');
    (db.artifactTemplate.delete as jest.Mock).mockRejectedValue(dbError);
    (handlePrismaError as jest.Mock).mockReturnValue('DB failure');

    await expect(deleteTemplate(templateId)).rejects.toThrow('DB failure');
    expect(logger.error).toHaveBeenCalledWith('Error deleting template', dbError);
    expect(handlePrismaError).toHaveBeenCalledWith(dbError);
  });
});
