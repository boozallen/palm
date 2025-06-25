import logger from '@/server/logger';
import db from '@/server/db';
import { AiAgent } from '@/features/shared/types/ai-agent';

export default async function getAiAgents(): Promise<AiAgent[]> {

  let results = null;
  try {
    results = await db.aiAgent.findMany();
  } catch (error) {
    logger.error('Error fetching AI Agents', error);
    throw new Error('Error fetching AI Agents');
  }

  return results.map((agent: AiAgent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    enabled: agent.enabled,
  }));
}
