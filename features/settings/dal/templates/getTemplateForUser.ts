import db from '@/server/db';
import logger from '@/server/logger';

export default async function getTemplateForUser(
  userId: string,
  fileExtension: string,
): Promise<Buffer | null> {
  try {
    const extensions = fileExtension === 'pptx' ? ['.pptx', '.potx'] : [`.${fileExtension}`];
    const membership = await db.userGroupMembership.findFirst({
      where: { userId },
      select: {
        userGroup: {
          select: {
            artifactTemplates: {
              where: { OR: extensions.map((ext) => ({ filename: { endsWith: ext } })) },
              select: { fileData: true },
              take: 1,
            },
          },
        },
      },
    });

    const fileData = membership?.userGroup?.artifactTemplates[0]?.fileData ?? null;
    return fileData ? Buffer.from(fileData) : null;
  } catch (error) {
    logger.error('Error getting template for user', error);
    throw new Error('Error getting template for user');
  }
}
