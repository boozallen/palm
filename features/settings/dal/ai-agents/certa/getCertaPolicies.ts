import { AgentPolicy } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

/**
 * Gets all policies of a specified agent.
 * @param {string} id The agent id
 */
export default async function getCertaPolicies(id: string): Promise<AgentPolicy[]> {

  try {
    const policies = await db.agentCertaPolicy.findMany({
      where: {
        aiAgentId: id,
      },
    });

    return policies.map((policy) => ({
      id: policy.id,
      aiAgentId: policy.aiAgentId,
      title: policy.title,
      content: policy.content,
      requirements: policy.requirements,
    }));
  } catch (error) {
    logger.error('Error fetching CERTA policies: ', error);
    throw new Error('Error fetching CERTA policies');
  }

}
