import { AgentPolicy } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

type NewCertaPolicy = {
  aiAgentId: string;
  title: string;
  content: string;
  requirements: string;
}

export default async function createCertaPolicy(
  input: NewCertaPolicy,
): Promise<AgentPolicy> {

  try {
    const response = await db.agentCertaPolicy.create({
      data: input,
    });

    return {
      id: response.id,
      aiAgentId: response.aiAgentId,
      title: response.title,
      content: response.content,
      requirements: response.requirements,
    };
  } catch (error) {
    logger.error('Error creating CERTA policy:', error);
    throw new Error('Error creating CERTA policy');
  }
}
