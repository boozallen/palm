import db from '@/server/db';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

/**
 * Deletes a specific policy from the AgentCertaPolicy table
 * @param {string} policyId
 */
export default async function deleteCertaPolicy(policyId: string) {
  try {
    const deletedCertaPolicy = await db.agentCertaPolicy.delete({
      where: { id: policyId },
      select: {
        id: true,
        aiAgentId: true,
      },
    });

    return { 
      id: deletedCertaPolicy.id,
      aiAgentId: deletedCertaPolicy.aiAgentId,
    };
  } catch (error) {
    logger.error('Error deleting CERTA policy', error);
    throw new Error(handlePrismaError(error));
  }
}
