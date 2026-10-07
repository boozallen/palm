import { useState } from 'react';
import { Box, Text, Center, Loader } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import {
  sortConversationsByMostRecentlyUpdated,
  categorizeConversationsByDateSections,
} from '@/features/chat/utils/chatHelperFunctions';
import DeleteChatModal from '@/components/navbar/modals/DeleteChatConversationModal';
import ChatHistoryNavLink from '@/components/navbar/ChatHistoryNavLink';
import useGetChats from '@/features/chat/api/get-chats';

interface ChatHistoryProps {
  isCollapsed?: boolean;
}

export default function ChatHistory({ isCollapsed = false }: ChatHistoryProps) {
  const [
    deleteChatModalOpened,
    {
      open: openDeleteChatModal,
      close: closeDeleteChatModal,
    },
  ] = useDisclosure(false);

  const [selectedChatId, setSelectedChatId] = useState('');

  const {
    data: getChatsData,
    isPending: getChatsIsPending,
    error: getChatsError,
  } = useGetChats();

  if (getChatsIsPending) {
    return <Center mt='md'><Loader size='sm' /></Center>;
  }
  if (getChatsError) {
    return <Box>{getChatsError?.message}</Box>;
  }

  const chats = getChatsData.chats
    .map((chat) => ({
      ...chat,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
    }));

  const sortedChats =
    sortConversationsByMostRecentlyUpdated(chats);
  const categorizedByDateConversations = categorizeConversationsByDateSections(
    sortedChats
  );

  function handleOpenDeleteChatModal(event: React.MouseEvent, chatId: string) {
    event.stopPropagation();
    event.preventDefault();
    setSelectedChatId(chatId);
    openDeleteChatModal();
  }

  return (
    <>
      <DeleteChatModal
        modalOpened={deleteChatModalOpened}
        closeModalHandler={closeDeleteChatModal}
        chatId={selectedChatId}
      />
      {!isCollapsed && categorizedByDateConversations.map((category) => {
        return (
          <Box key={category.id} px='md'>
            <Text fz='xs' fw='bolder' c='dark.0' key={category.id} mb='xs'>
              {category.title}
            </Text>
            {category.chats?.map((chat) => (
              <ChatHistoryNavLink
                key={chat.id}
                chatId={chat.id}
                summary={chat.summary}
                promptId={chat.promptId}
                onDeleteClick={handleOpenDeleteChatModal}
              />
            ))}
          </Box>
        );
      })}
    </>
  );
}
