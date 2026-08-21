import db from '@/server/db';
import logger from '@/server/logger';

type ArtifactTemplateListItem = {
  id: string;
  filename: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function getUserGroupArtifactTemplates(
  userGroupId: string,
): Promise<ArtifactTemplateListItem[]> {
  try {
    const result = await db.userGroup.findUniqueOrThrow({
      where: { id: userGroupId },
      select: {
        artifactTemplates: {
          select: {
            id: true,
            filename: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return result.artifactTemplates;
  } catch (error) {
    logger.error('Error getting user group artifact templates', error);
    throw new Error('Error getting user group artifact templates');
  }
}
