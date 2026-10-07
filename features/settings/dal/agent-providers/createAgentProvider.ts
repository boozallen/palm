import db from '@/server/db';
import logger from '@/server/logger';

type CreateAgentProviderInput = {
  name: string;
  description: string;
  endpoint: string;
  apiKey?: string;
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

export default async function createAgentProvider(
  input: CreateAgentProviderInput,
): Promise<AgentProviderRecord> {
  try {
    const provider = await db.agentProvider.create({
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
    logger.error('Error creating agent provider', error);
    throw new Error('Error creating agent provider');
  }
}
