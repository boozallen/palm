import db from '@/server/db';
import logger from '@/server/logger';

type GetWorkflowArtifactInput = {
  artifactId: string;
};

export default async function getWorkflowArtifact(input: GetWorkflowArtifactInput) {
  try {
    const artifact = await db.workflowArtifact.findUnique({
      where: { id: input.artifactId },
      include: {
        workflowExecution: {
          select: {
            id: true,
            triggeredBy: true,
            workflowId: true,
          },
        },
      },
    });

    return artifact;
  } catch (error) {
    logger.error(`Error fetching workflow artifact: ${input.artifactId}`, error);
    throw new Error('Error fetching workflow artifact');
  }
}
