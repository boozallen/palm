import { createHash } from 'crypto';

import { AIFactory } from '@/features/ai-provider';
import summarizeUseCaseThemes, {
  THEME_PROMPT_VERSION,
  ThemeInputChat,
} from '@/features/context-studio/services/summarizeUseCaseThemes';
import { UseCaseThemes } from '@/features/context-studio/types/use-case-detail';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { UseCase } from '@/features/shared/types/use-case';
import db from '@/server/db';
import logger from '@/server/logger';

const CACHE_RETENTION_DAYS = 30;

// Validates that a cached row has the expected shape. A row written under an
// older schema lives forever without a TTL, so we must check before returning.
function isValidUseCaseThemes(data: unknown): data is UseCaseThemes {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.themes)) {
    return false;
  }

  for (const theme of obj.themes) {
    if (!theme || typeof theme !== 'object') {
      return false;
    }
    const t = theme as Record<string, unknown>;
    if (
      typeof t.name !== 'string' ||
      typeof t.chats !== 'number' ||
      typeof t.cost !== 'number' ||
      !Number.isFinite(t.chats) ||
      !Number.isFinite(t.cost)
    ) {
      return false;
    }
  }

  if (obj.remainder !== null) {
    if (!obj.remainder || typeof obj.remainder !== 'object') {
      return false;
    }
    const remainder = obj.remainder as Record<string, unknown>;
    if (
      typeof remainder.chats !== 'number' ||
      typeof remainder.cost !== 'number' ||
      !Number.isFinite(remainder.chats) ||
      !Number.isFinite(remainder.cost)
    ) {
      return false;
    }
  }

  if (
    typeof obj.coveredChats !== 'number' ||
    typeof obj.analyzedChats !== 'number' ||
    typeof obj.truncated !== 'boolean' ||
    !Number.isFinite(obj.coveredChats) ||
    !Number.isFinite(obj.analyzedChats)
  ) {
    return false;
  }

  return true;
}

// A content hash of the prompt version, the category, and every field that reaches
// the prompt or the dollars we sum — which is what makes this cache correct without
// a TTL. JSON.stringify, not a delimiter join: a title may contain any character.
export function buildThemeCacheKey(useCase: UseCase, chats: ThemeInputChat[]): string {
  const content = [...chats]
    .sort((a, b) => a.chatId.localeCompare(b.chatId))
    .map((chat) => [chat.chatId, chat.title, chat.cost, [...chat.artifactNames].sort(), chat.excerpts]);

  return createHash('sha256')
    .update(JSON.stringify([THEME_PROMPT_VERSION, useCase, content]))
    .digest('hex');
}

export default async function getUseCaseThemes(
  useCase: UseCase,
  chats: ThemeInputChat[],
  viewerUserId: string,
  viewerUserGroupId?: string,
): Promise<UseCaseThemes | null> {
  if (chats.length === 0) {
    return null;
  }

  try {
    const cacheKey = buildThemeCacheKey(useCase, chats);

    const cached = await db.useCaseThemeSummary.findUnique({
      where: { cacheKey },
    });

    if (cached && isValidUseCaseThemes(cached.themes)) {
      return cached.themes;
    }

    const ai = new AIFactory({ userId: viewerUserId, userGroupId: viewerUserGroupId });
    const result = await summarizeUseCaseThemes(ai, chats);

    if (result === null) {
      return null;
    }

    await db.useCaseThemeSummary.create({
      data: {
        cacheKey,
        useCase,
        themes: result,
        chatCount: chats.length,
      },
    });

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - CACHE_RETENTION_DAYS);

      await db.useCaseThemeSummary.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });
    } catch (pruneError) {
      logger.error('Failed to prune old theme cache rows', { pruneError });
    }

    return result;
  } catch (error) {
    logger.error('Failed to get use case themes', { error });
    throw new Error(handlePrismaError(error));
  }
}
