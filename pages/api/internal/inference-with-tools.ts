import type { NextApiHandler } from 'next';

import logger from '@/server/logger';
import { AIFactory, type BuildResult } from '@/features/ai-provider/factory';
import { type AiRepository, ToolDefinition, ToolAwareMessage } from '@/features/ai-provider/sources/types';
import { AiSettings } from '@/types';
import { UsageAttribution } from '@/features/ai-provider/sources/AiProviderUsageTracker';
import { parseUsageAttribution } from '@/features/ai-provider/utils/usageAttribution';

const _PROVIDER_TTL_MS = 5 * 60 * 1000;
const _baseCache = new Map<string, { base: BuildResult; expiresAt: number }>();

async function _getBase(userId: string, modelId: string): Promise<BuildResult> {
  const cached = _baseCache.get(modelId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.base;
  }
  const factory = new AIFactory({ userId });
  const base = await factory.buildSource(modelId);
  _baseCache.set(modelId, { base, expiresAt: Date.now() + _PROVIDER_TTL_MS });
  return base;
}

async function _getAiSource(userId: string, modelId: string, attribution: UsageAttribution): Promise<{ source: AiRepository; externalId: string }> {
  const base = await _getBase(userId, modelId);
  const factory = new AIFactory({ userId });
  const ai = await factory.wrapUserSource(base, modelId, {
    agent: true,
    auditContext: { referer: '/api/internal/inference-with-tools' },
    attribution,
  });
  return { source: ai.source, externalId: ai.model.externalId };
}

export async function warmInferenceCache(userId: string, modelId: string): Promise<void> {
  await _getBase(userId, modelId);
}

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    logger.error('[INTERNAL/INFERENCE-WITH-TOOLS] INTERNAL_API_KEY is not configured');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${internalApiKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { userId, modelId, messages, tools, temperature, topP, forceToolUse } = req.body as {
    userId: string;
    modelId: string;
    messages: ToolAwareMessage[];
    tools: ToolDefinition[];
    temperature?: number;
    topP?: number;
    forceToolUse?: boolean;
  };

  if (!userId || !modelId || !Array.isArray(messages) || messages.length === 0 || !Array.isArray(tools)) {
    res.status(400).json({ error: 'Missing required fields: userId, modelId, messages, tools' });
    return;
  }

  try {
    const ai = await _getAiSource(userId, modelId, parseUsageAttribution(req.body));

    if (!ai.source.chatCompletionWithTools) {
      res.status(400).json({ error: 'Provider does not support tool use' });
      return;
    }

    const config: AiSettings = {
      model: ai.externalId,
      temperature: temperature ?? 0.2,
      topP: topP ?? 0.5,
    };

    const response = await ai.source.chatCompletionWithTools(messages, tools, config, forceToolUse);
    res.status(200).json(response);
  } catch (error) {
    logger.error('[INTERNAL/INFERENCE-WITH-TOOLS] Failed', { userId, modelId, error: (error as Error).message ?? String(error) });
    res.status(500).json({ error: (error as Error).message });
  }
};

export default handler;
