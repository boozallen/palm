import { PrismaClient } from '@prisma/client';

import { PromptStatsMap } from '@/features/shared/types/prompt';

/**
 * Get statistics for prompts including bookmark count and usage count
 */
export async function getPromptStats(
  prisma: PrismaClient,
  promptIds: string[]
): Promise<PromptStatsMap> {
  if (promptIds.length === 0) {
    return {};
  }

  // Get bookmark counts for all prompts in parallel
  const bookmarkCounts = await prisma.promptBookmark.groupBy({
    by: ['promptId'],
    where: {
      promptId: {
        in: promptIds,
      },
    },
    _count: {
      userId: true,
    },
  });

  // Get usage counts (number of chats using each prompt) in parallel
  const usageCounts = await prisma.chat.groupBy({
    by: ['promptId'],
    where: {
      promptId: {
        in: promptIds,
        not: null,
      },
    },
    _count: {
      id: true,
    },
  });

  // Build the stats map
  const statsMap: PromptStatsMap = {};

  // Initialize all prompt IDs with zero stats
  for (const promptId of promptIds) {
    statsMap[promptId] = {
      bookmarkCount: 0,
      usageCount: 0,
    };
  }

  // Fill in bookmark counts
  for (const bookmark of bookmarkCounts) {
    if (statsMap[bookmark.promptId]) {
      statsMap[bookmark.promptId].bookmarkCount = bookmark._count.userId;
    }
  }

  // Fill in usage counts
  for (const usage of usageCounts) {
    if (usage.promptId && statsMap[usage.promptId]) {
      statsMap[usage.promptId].usageCount = usage._count.id;
    }
  }

  return statsMap;
}

/**
 * Get global prompt statistics for all prompts (used for filtering by popularity)
 */
export async function getAllPromptStats(prisma: PrismaClient): Promise<PromptStatsMap> {
  // Get all prompt IDs first
  const prompts = await prisma.prompt.findMany({
    select: { id: true },
  });

  const promptIds = prompts.map(p => p.id);
  return getPromptStats(prisma, promptIds);
}
