import { useMemo } from 'react';
import { Entries, EntryType, MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import { DefaultSystemMessage } from '@/features/shared/utils';
import useGetMessages from '@/features/chat/api/get-messages';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';

export default function useFormatChatEntries(
  chatId: string | null,
  promptId: string | null,
  pendingMessage: string | null,
  systemMessage: string | null,
  regeneratingResponse: boolean
) {
  const messagesQry = useGetMessages(chatId);
  const promptQry = useGetOriginPrompt(promptId);

  const entries = useMemo(() => {
    const entries: Entries = [];

    const placeholder: MessageEntry = {
      id: 'placeholder',
      chatId: chatId ?? '',
      type: EntryType.Message,
      role: MessageRole.System,
      content: systemMessage ?? DefaultSystemMessage,
      createdAt: new Date(),
    };

    if (!promptQry.isPending && promptQry.isFetched && promptQry.data) {
      const { prompt } = promptQry.data;
      placeholder.content = prompt.instructions;
    }

    if (!messagesQry.isPending && messagesQry.isFetched && messagesQry.data) {
      const { messages: msgs } = messagesQry.data;
      for (let msg of msgs) {
        entries.push({
          id: msg.id,
          chatId: chatId ?? '',
          type: EntryType.Message,
          role: msg.role as MessageRole,
          content: msg.content,
          citations: msg.citations,
          artifacts: msg.artifacts.map(artifact => ({
            ...artifact,
            createdAt: new Date(artifact.createdAt),
          })),
          createdAt: new Date(msg.messagedAt),
        });
      }

      const lastMessage = msgs[msgs.length - 1];
      if (lastMessage && lastMessage.role === MessageRole.User) {
        if (regeneratingResponse) {
          entries.push({
            id: `retry-${lastMessage.id}`,
            chatId: chatId ?? '',
            type: EntryType.Skeleton,
            role: MessageRole.Assistant,
            createdAt: new Date(),
          });
        } else {
          entries.push({
            id: `retry-${lastMessage.id}`,
            chatId: chatId ?? '',
            type: EntryType.Retry,
            role: MessageRole.Assistant,
            createdAt: new Date(),
          });
        }
      }
    } else {
      entries.push(placeholder);
    }

    if (!!pendingMessage) {
      entries.push(
        {
          id: 'pending',
          chatId: chatId ?? '',
          type: EntryType.Message,
          role: MessageRole.User,
          content: pendingMessage,
          createdAt: new Date(),
        },
        {
          id: 'pending',
          chatId: chatId ?? '',
          type: EntryType.Skeleton,
          role: MessageRole.Assistant,
          createdAt: new Date(),
        }
      );
    }

    entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return entries;
  }, [
    chatId,
    systemMessage,
    promptQry.isPending,
    promptQry.isFetched,
    promptQry.data,
    messagesQry.isPending,
    messagesQry.isFetched,
    messagesQry.data,
    pendingMessage,
    regeneratingResponse,
  ]);

  return entries;
}

