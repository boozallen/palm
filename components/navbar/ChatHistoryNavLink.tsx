import { useMemo } from 'react';
import { ActionIcon, Loader, NavLink, ThemeIcon } from '@mantine/core';
import { IconMessageCircle2, IconTrash } from '@tabler/icons-react';

import { generateConversationUrl } from '@/features/chat/utils/chatHelperFunctions';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import useUpdateChatConversationSummary from '@/features/chat/api/update-chat-conversation-summary';
import SafeExit from '@/components/navbar/SafeExit';

type ChatHistoryNavLinkProps = Readonly<{
  chatId: string;
  summary: string | null;
  promptId: string | null;
  onDeleteClick: (event: React.MouseEvent, chatId: string) => void;
}>

export default function ChatHistoryNavLink({ chatId, summary, promptId, onDeleteClick }: ChatHistoryNavLinkProps) {
  const promptQry = useGetOriginPrompt(promptId);
  const href = generateConversationUrl(chatId, promptQry.data?.prompt.title);

  const {
    mutate: updateChatConversationSummary,
  } = useUpdateChatConversationSummary();

  const chatSummary = useMemo(() => {
    if (summary === '') {
      updateChatConversationSummary({ chatId });
    }
    return summary ?? '';
  }, [summary, chatId, updateChatConversationSummary]);

  return (
    
    <NavLink
      component={SafeExit}
      href={href}
      data-testid={`${chatId}-chat-history-nav-link`}
      label={!chatSummary
        ?
        <Loader variant='dots' color='gray' pl='sm'
          data-testid={`${chatId}-loader`}
        />
        :
        chatSummary
      }
      title={chatSummary}
      icon={
        <ThemeIcon size='sm'>
          <IconMessageCircle2 />
        </ThemeIcon>
      }
      rightSection={
        <ActionIcon c='dark.0'
          data-testid={`${chatId}-chat-delete-icon`}
          onClick={(event: React.MouseEvent) => onDeleteClick(event, chatId)}
        >
          <ThemeIcon size='sm' c='currentColor'>
            <IconTrash aria-label='Delete chat' />
          </ThemeIcon>
        </ActionIcon>
      }
    />
  );
};
