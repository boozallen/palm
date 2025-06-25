import { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import {
  sortConversationsByMostRecentlyUpdated,
  categorizeConversationsByDateSections,
} from '@/features/chat/utils/chatHelperFunctions';
import DeleteChatModal from '@/components/navbar/modals/DeleteChatConversationModal';
import ChatHistoryNavLink from '@/components/navbar/ChatHistoryNavLink';
import useGetChats from '@/features/chat/api/get-chats';

export default function ChatHistory() {
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
    return <Box>Loading...</Box>;
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
      {categorizedByDateConversations.map((category) => {
        return (
          <Box key={category.id} mx='lg'>
            <Text fz='xs' fw='bolder' c='dark.0' key={category.id} mt='md'>
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
