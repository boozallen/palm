import db from '@/server/db';
import logger from '@/server/logger';

type AgentProviderListItem = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function getAgentProviders(): Promise<AgentProviderListItem[]> {
  try {
    const providers = await db.agentProvider.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      endpoint: p.endpoint,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  } catch (error) {
    logger.error('Error fetching agent providers', error);
    throw new Error('Error fetching agent providers');
  }
}
