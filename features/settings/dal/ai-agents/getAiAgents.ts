import logger from '@/server/logger';
import db from '@/server/db';
import { AiAgent, AiAgentType } from '@/features/shared/types/ai-agent';

export default async function getAiAgents(): Promise<AiAgent[]> {

  let results = null;
  try {
    results = await db.aiAgent.findMany();
  } catch (error) {
    logger.error('Error fetching AI Agents', error);
    throw new Error('Error fetching AI Agents');
  }

  // Note: label maps to database field 'name' for consistency with UI naming convention
  return results.map((agent) => ({
    id: agent.id,
    label: agent.name,
    description: agent.description,
    type: agent.agentType as AiAgentType,
  }));
}
