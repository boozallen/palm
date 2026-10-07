import db from '@/server/db';
import logger from '@/server/logger';

type AgentProviderRecord = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  apiKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function getAgentProvider(id: string): Promise<AgentProviderRecord> {
  try {
    const provider = await db.agentProvider.findFirst({
      where: { id, deletedAt: null },
    });

    if (!provider) {
      throw new Error('Agent provider not found');
    }

    return {
      id: provider.id,
      name: provider.name,
      description: provider.description,
      endpoint: provider.endpoint,
      apiKey: provider.apiKey,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  } catch (error) {
    logger.error('Error fetching agent provider', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error fetching agent provider');
  }
}
