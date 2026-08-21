import { UnstyledButton, Group, Text } from '@mantine/core';
import { IconTopologyRing } from '@tabler/icons-react';

import Entry from '@/features/chat/components/entries/Entry';
import { UserAvatar } from '@/features/chat/components/entries/elements/Avatars';
import { MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import SelectedTextSent from './elements/SelectedTextSent';
import { selectedTextSentParser } from '@/features/chat/utils/selectedTextHelperFunctions';
import { UserEntryActions } from './actions/UserEntryActions';
import { EditableUserEntry } from './EditableUserEntry';
import { useChat } from '@/features/chat/providers/ChatProvider';

type UserEntryProps = Readonly<{
  entry: MessageEntry;
}>;

export default function UserEntry({ entry }: UserEntryProps) {
  const { entryBeingEdited, useGraph, openGraphSnapshot } = useChat();
  const { selectedText, userMessage } = selectedTextSentParser(entry.content);

  const snapshotId = entry.graphSnapshotId;
  const snapshotNodeCount = entry.graphSnapshotNodeCount ?? 0;

  return entryBeingEdited === entry.id ? (
    <EditableUserEntry entry={entry} />
  ) : (
    <Entry
      id={entry.id}
      avatar={<UserAvatar />}
      role={MessageRole.User}
      useGraph={useGraph}
      actions={
        <UserEntryActions
          entryId={entry.id}
        />
      }
    >
      {selectedText && <SelectedTextSent content={selectedText} />}
      <pre className='user-entry-content'>
        {userMessage}
      </pre>
      {snapshotId && (
        <UnstyledButton
          onClick={() => openGraphSnapshot(snapshotId)}
          mt={6}
          sx={(theme) => ({
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: theme.radius.sm,
            color: theme.colors.cyan[4],
            backgroundColor: theme.colors.dark[6],
            '&:hover': { backgroundColor: theme.colors.dark[5] },
          })}
        >
          <Group spacing={4}>
            <IconTopologyRing size={12} />
            <Text size={11}>
              View graph at this question ({snapshotNodeCount} {snapshotNodeCount === 1 ? 'node' : 'nodes'})
            </Text>
          </Group>
        </UnstyledButton>
      )}
    </Entry>
  );
}
