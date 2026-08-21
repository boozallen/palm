import type { NextApiHandler } from 'next';

import logger from '@/server/logger';
import { AIFactory } from '@/features/ai-provider/factory';
import { ChatCompletionMessage } from '@/features/ai-provider/sources/types';
import { parseUsageAttribution } from '@/features/ai-provider/utils/usageAttribution';

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    logger.error('[INTERNAL/INFERENCE] INTERNAL_API_KEY is not configured');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${internalApiKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { userId, modelId, messages, temperature, topP, maxTokens } = req.body as {
    userId: string;
    modelId: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  };

  if (!userId || !modelId || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Missing required fields: userId, modelId, messages' });
    return;
  }

  try {
    const aiFactory = new AIFactory({ userId });
    // Attribution ties this call to the artifact that caused it. The agent flag
    // is deliberately left false: flipping it would move spend that already
    // exists out of the chat analytics bucket into the agent bucket.
    const ai = await aiFactory.buildUserSource(modelId, {
      auditContext: { referer: '/api/internal/inference' },
      attribution: parseUsageAttribution(req.body),
    });
    const response = await ai.source.chatCompletion(messages, {
      model: ai.model.externalId,
      temperature: temperature ?? 0.2,
      topP: topP ?? 0.5,
      ...(maxTokens ? { maxTokens } : {}),
    });

    res.status(200).json({
      text: response.text,
      inputTokensUsed: response.inputTokensUsed,
      outputTokensUsed: response.outputTokensUsed,
    });
  } catch (error) {
    logger.error('[INTERNAL/INFERENCE] Inference failed', { userId, modelId, error });
    res.status(500).json({ error: (error as Error).message });
  }
};

export default handler;
