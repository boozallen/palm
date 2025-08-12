import logger from '@/server/logger';
import db from '@/server/db';
import { AgentPolicy } from '@/features/shared/types';

type UpdateCertaPolicy = {
  id: string;
  title: string;
  content: string;
  requirements: string;
};

export default async function updateCertaPolicy(input: UpdateCertaPolicy): Promise<AgentPolicy>{
  try {
    const certaPolicy = await db.agentCertaPolicy.findUnique({
      where: {
        id: input.id,
      },
      select: {
        id: true,
      },
    });

    if (!certaPolicy) {
      logger.warn(`CERTA policy could not be found: ${input.id}`);
      throw new Error('CERTA policy could not be found.');
    }

    const updatedCertaPolicy = await db.agentCertaPolicy.update({
      where: {
        id: input.id,
      },
      data: {
        title: input.title,
        content: input.content,
        requirements: input.requirements,
      },
      select: {
        id: true,
        title: true,
        content: true,
        requirements: true,
        aiAgentId: true,
      },
    });

    return {
      id: updatedCertaPolicy.id,
      title: updatedCertaPolicy.title,
      content: updatedCertaPolicy.content,
      requirements: updatedCertaPolicy.requirements,
      aiAgentId: updatedCertaPolicy.aiAgentId,
  
    };
  } catch (error) {
    logger.error('Error updating CERTA policy', error);
    throw new Error('Error updating CERTA policy');
  }
}
