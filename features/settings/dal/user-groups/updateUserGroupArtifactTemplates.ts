import db from '@/server/db';
import logger from '@/server/logger';

type ArtifactTemplateListItem = {
  id: string;
  filename: string;
  createdAt: Date;
  updatedAt: Date;
};

type UpdateUserGroupArtifactTemplatesInput = {
  userGroupId: string;
  templateId: string;
  enabled: boolean;
};

export default async function updateUserGroupArtifactTemplates(
  input: UpdateUserGroupArtifactTemplatesInput,
): Promise<ArtifactTemplateListItem[]> {
  const { userGroupId, templateId, enabled } = input;

  try {
    const result = await db.userGroup.update({
      where: { id: userGroupId },
      data: {
        artifactTemplates: enabled
          ? { connect: { id: templateId } }
          : { disconnect: { id: templateId } },
      },
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
    logger.error('Error updating user group artifact templates', error);
    throw new Error('Error updating user group artifact templates');
  }
}
