import { useEffect, useState } from 'react';
import { Text, Title, Button, Textarea, Box, Group, Flex, List } from '@mantine/core';
import { MessageEntry } from '@/features/chat/types/entry';
import { generatePromptUrl } from '@/features/shared/utils';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';

type SystemProps = Readonly<{
  entry: MessageEntry;
}>;

export default function SystemEntry({ entry }: SystemProps) {
  const { chatId, promptId, setSystemMessage, selectedArtifact } = useChat();
  const { data: originPrompt } = useGetOriginPrompt(promptId);

  // Users may only edit system message for new chats
  const chatHasNotStarted = chatId === null;

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(entry.content);
  const [lastSavedContent, setLastSavedContent] = useState(entry.content);

  // Use useEffect to update editedContent when originPrompt is loaded, 
  // to cover the case if it wasn't loaded by the time entry.content was initialized in ChatContent
  // We also don't want to overwrite the existing entry after the chat has started, 
  // so also check chatHasNotStarted
  useEffect(() => {
    if (chatHasNotStarted) {
      const initialContent = originPrompt?.prompt.instructions ?? entry.content;
      setEditedContent(initialContent);
      setLastSavedContent(initialContent);
    }
  }, [originPrompt, entry.content, promptId, chatHasNotStarted]);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleSaveClick = () => {
    setSystemMessage(editedContent);
    setLastSavedContent(editedContent);
    setIsEditing(false);
  };

  const handleCancelClick = () => {
    setEditedContent(lastSavedContent); // Reset to the last saved content
    setIsEditing(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveClick();
    }
  };

  return (
    <List.Item>
      <Box bg='dark.6' my='xl' mx={selectedArtifact ? 'md' : 'lg'}>
        <Title
          c='gray.6'
          fz='sm'
          fw='bold'
          order={4}
          px='xl'
          py='xs'
        >
          {originPrompt ? (
            <Text span>
              <Text span td='underline'>
                <a
                  href={generatePromptUrl(originPrompt.prompt.title, originPrompt.prompt.id)}
                  title={originPrompt.prompt.title}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  {originPrompt.prompt.title}
                </a>
              </Text>
              {' prompt from the Prompt Library'}
            </Text>
          ) : (
            'System Persona'
          )}
        </Title>
        <Box bg='dark.8' pt='lg' px='lg' pb={isEditing ? 'sm' : 'lg'}>
          <Flex align='flex-start' justify='space-between'>
            <Box sx={{ flex: 1 }} mr='md'>
              {isEditing ? (
                <Textarea
                  aria-label='Edit system persona message'
                  value={editedContent}
                  onChange={(event) => setEditedContent(event.currentTarget.value)}
                  onKeyDown={onKeyDown}
                  autosize
                  minRows={1}
                  maxRows={15}
                  c='gray.6'
                  fz='sm'
                  styles={(theme) => ({
                    input: {
                      backgroundColor: theme.colors.dark[8],
                      border: `1px solid ${theme.colors.dark[1]}`,
                    },
                  })}
                />
              ) : (
                <Text c='gray.6' fz='sm' p='sm' sx={{ whiteSpace: 'pre-wrap' }}>
                  {editedContent}
                </Text>
              )}
            </Box>
            {chatHasNotStarted ? (
              <>
                {isEditing ? (
                  <Group>
                    <Button size='xs' onClick={handleSaveClick} disabled={editedContent.length === 0}>
                      Save
                    </Button>
                    <Button size='xs' variant='outline' color='gray' onClick={handleCancelClick}>
                      Cancel
                    </Button>
                  </Group>
                ) :
                  <Button size='xs' variant='outline' color='gray' onClick={handleEditClick}>
                    Edit
                  </Button>}
              </>
            ) : null}
          </Flex>
        </Box>
      </Box >
    </List.Item>
  );
}
