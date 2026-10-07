import { useCallback, useEffect, useState } from 'react';
import { Text, Title, Button, Textarea, Box, Group, List, Collapse, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { MessageEntry } from '@/features/chat/types/entry';
import { generatePromptUrl } from '@/features/shared/utils';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import useUpdateMessage from '@/features/chat/api/update-message';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type SystemProps = Readonly<{
  entry: MessageEntry;
}>;

export default function SystemEntry({ entry }: SystemProps) {
  const router = useRouter();
  const { promptId, setSystemMessage, selectedArtifact, setEntryBeingEdited, triggerEditSystemPrompt, setTriggerEditSystemPrompt } = useChat();
  const { data: originPrompt } = useGetOriginPrompt(promptId);
  const updateMessage = useUpdateMessage();
  const track = useTrackClientEvent();

  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(entry.content);
  const [savedContent, setSavedContent] = useState(entry.content);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Use useEffect to update draftContent when originPrompt is loaded,
  // to cover the case if it wasn't loaded by the time entry.content was initialized in ChatContent
  useEffect(() => {
    const initialContent = originPrompt?.prompt.instructions ?? entry.content;
    setDraftContent(initialContent);
    setSavedContent(initialContent);
  }, [originPrompt, entry.content, promptId]);

  const handleEditClick = useCallback(() => {
    setIsCollapsed(false);
    setIsEditing(true);
    setEntryBeingEdited(entry.id);
  }, [entry.id, setEntryBeingEdited]);

  // Listen for trigger to edit system prompt
  useEffect(() => {
    if (triggerEditSystemPrompt) {
      handleEditClick();
      setTriggerEditSystemPrompt(false);
    }
  }, [triggerEditSystemPrompt, setTriggerEditSystemPrompt, handleEditClick]);

  // Auto-expand accordion when promptId is in URL
  useEffect(() => {
    if (router.isReady && router.query.promptid) {
      setIsCollapsed(false);
    }
  }, [router.isReady, router.query.promptid]);

  const handleSaveClick = async () => {
    try {
      // Update db chatMessage record
      if (entry.id !== 'placeholder') {
        await updateMessage.mutateAsync({
          messageId: entry.id,
          content: draftContent,
        });
      }
      
      // Update local ChatProvider state
      setSystemMessage(draftContent);
      setSavedContent(draftContent);
      setIsEditing(false);
      setEntryBeingEdited(null);
    } catch (error) {
      notifications.show({
        title: 'Failed to Update System Message',
        message: 'An unexpected error occurred. Please try again later.',
        icon: <IconX />,
        autoClose: true,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleCancelClick = () => {
    setDraftContent(savedContent); // Reset draft content
    setIsEditing(false);
    setEntryBeingEdited(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveClick();
    }
  };

  return (
    <List.Item>
      <Box
        bg='dark.4'
        mb='md'
        mx={selectedArtifact ? 'md' : 'md'}
        style={{ borderRadius: '8px' }}
      >
        <Group
          position='apart'
          align='center'
          px='md'
          py='xs'
          sx={{ cursor: 'pointer' }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <Title
            c='gray.6'
            fz='sm'
            fw='bold'
            order={4}
          >
            {originPrompt ? (
              <Text span>
                <Text span td='underline'>
                  <a
                    href={generatePromptUrl(originPrompt.prompt.title, originPrompt.prompt.id)}
                    title={originPrompt.prompt.title}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={(e) => {
                      e.stopPropagation();
                      track.navigate(originPrompt.prompt.title, generatePromptUrl(originPrompt.prompt.title, originPrompt.prompt.id));
                    }}
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
          <ActionIcon
            variant='subtle'
            color='gray'
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            {isCollapsed ? <IconChevronDown size={18} /> : <IconChevronUp size={18} />}
          </ActionIcon>
        </Group>
        <Collapse in={!isCollapsed}>
          <Box bg='dark.5' pt='lg' px='sm' pb={isEditing ? 'sm' : 'lg'} style={{ borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
            {isEditing ? (
              <Group position='apart' align='flex-start'>
                <Textarea
                  aria-label='Edit system persona message'
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.currentTarget.value)}
                  onKeyDown={onKeyDown}
                  autosize
                  minRows={1}
                  maxRows={15}
                  c='gray.6'
                  fz='sm'
                  sx={{ flex: 1 }}
                  styles={(theme) => ({
                    input: {
                      backgroundColor: theme.colors.dark[8],
                      border: `1px solid ${theme.colors.dark[1]}`,
                    },
                  })}
                />
                <Group spacing='md'>
                  <Button size='xs' onClick={handleSaveClick} disabled={draftContent.length === 0}>
                    Save
                  </Button>
                  <Button size='xs' variant='outline' color='gray' onClick={handleCancelClick}>
                    Cancel
                  </Button>
                </Group>
              </Group>
            ) : (
              <Group position='apart' align='flex-start'>
                <Text c='gray.6' fz='sm' p='sm' sx={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                  {draftContent}
                </Text>
                <Box p='sm'>
                  <Button size='xs' variant='outline' color='gray' onClick={handleEditClick}>
                    Edit
                  </Button>
                </Box>
              </Group>
            )}
          </Box>
        </Collapse>
      </Box >
    </List.Item>
  );
}
