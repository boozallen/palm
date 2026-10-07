import { trpc } from '@/libs';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';

export default function useGetChatTranscript(
  chatId: string | null,
  useCase: UseCase,
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  isEnabled: boolean,
) {
  return trpc.contextStudio.getChatTranscript.useQuery({
    chatId: chatId ?? '',
    useCase,
    timeRange,
    userGroupId,
    userId,
    excludeAdmins: true,
  }, {
    enabled: isEnabled && chatId !== null,
  });
}
