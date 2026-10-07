import logger from '@/server/logger';
import db from '@/server/db';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

type CreateTemplateInput = {
  filename: string;
  fileData: string;
};

type CreateTemplateResult = {
  id: string;
  filename: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function createTemplate(input: CreateTemplateInput): Promise<CreateTemplateResult> {
  try {
    return await db.artifactTemplate.create({
      data: {
        filename: input.filename,
        fileData: Buffer.from(input.fileData, 'base64'),
      },
      select: {
        id: true,
        filename: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    logger.error('Error creating template', error);
    throw new Error(handlePrismaError(error));
  }
}
