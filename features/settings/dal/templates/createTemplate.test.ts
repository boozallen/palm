import createTemplate from './createTemplate';
import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

jest.mock('@/server/db', () => ({
  artifactTemplate: {
    create: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors');

const mockResult = {
  id: '00000000-0000-0000-0000-000000000001',
  filename: 'sample-template.pptx',
  createdAt: new Date('2026-08-10T00:00:00.000Z'),
  updatedAt: new Date('2026-08-10T00:00:00.000Z'),
};

const validInput = {
  filename: 'sample-template.pptx',
  fileData: Buffer.from('test').toString('base64'),
};

describe('createTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.artifactTemplate.create as jest.Mock).mockResolvedValue(mockResult);
  });

  it('creates a template and returns it without fileData', async () => {
    const result = await createTemplate(validInput);

    expect(db.artifactTemplate.create).toHaveBeenCalledWith({
      data: {
        filename: validInput.filename,
        fileData: Buffer.from(validInput.fileData, 'base64'),
      },
      select: {
        id: true,
        filename: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(result).toEqual(mockResult);
  });

  it('throws and logs if the DB query fails', async () => {
    const dbError = new Error('DB failure');
    (db.artifactTemplate.create as jest.Mock).mockRejectedValue(dbError);
    (handlePrismaError as jest.Mock).mockReturnValue('DB failure');

    await expect(createTemplate(validInput)).rejects.toThrow('DB failure');
    expect(logger.error).toHaveBeenCalledWith('Error creating template', dbError);
    expect(handlePrismaError).toHaveBeenCalledWith(dbError);
  });
});
