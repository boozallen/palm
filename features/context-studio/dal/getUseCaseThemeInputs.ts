import getChatRequestExcerpts from '@/features/context-studio/dal/getChatRequestExcerpts';
import {
  queryUseCaseArtifacts,
  queryUseCaseChats,
} from '@/features/context-studio/dal/useCaseChatQueries';
import { ThemeInputChat } from '@/features/context-studio/services/summarizeUseCaseThemes';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import logger from '@/server/logger';

// What the roll-up reads: the category's chats, their work product names and what the
// person actually wrote. It shares the chat and artifact queries with the drawer's
// detail, so both describe the same work, but skips the spend, weekly, total and
// egress reads that only the displayed figures need.
export default async function getUseCaseThemeInputs(
  useCase: UseCase,
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = true,
): Promise<ThemeInputChat[]> {
  try {
    const scope = { useCase, timeRange, userGroupId, userId, excludeAdmins };

    const [chatRows, artifactRows] = await Promise.all([
      queryUseCaseChats(scope),
      queryUseCaseArtifacts(scope),
    ]);

    const artifactNamesByChat = new Map<string, string[]>();
    artifactRows.forEach((row) => {
      const names = artifactNamesByChat.get(row.chat_id) ?? [];
      names.push(row.name);
      artifactNamesByChat.set(row.chat_id, names);
    });

    const excerptsByChat = await getChatRequestExcerpts(chatRows.map((row) => row.chat_id));

    return chatRows.map((row) => ({
      chatId: row.chat_id,
      title: row.title,
      artifactNames: artifactNamesByChat.get(row.chat_id) ?? [],
      excerpts: excerptsByChat.get(row.chat_id) ?? [],
      cost: Number(row.cost ?? 0),
    }));
  } catch (error) {
    logger.error('Failed to load Context Studio use case theme inputs', { error });
    throw new Error('Failed to fetch use case theme inputs');
  }
}
