import db from '@/server/db';
import logger from '@/server/logger';

type UpdateAgentProviderInput = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  apiKey?: string | null;
};

type AgentProviderRecord = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  apiKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function updateAgentProvider(
  input: UpdateAgentProviderInput,
): Promise<AgentProviderRecord> {
  try {
    const provider = await db.agentProvider.update({
      where: { id: input.id },
      data: {
        name: input.name,
        description: input.description,
        endpoint: input.endpoint,
        apiKey: input.apiKey ?? null,
      },
    });

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
    logger.error('Error updating agent provider', error);
    throw new Error('Error updating agent provider');
  }
}
