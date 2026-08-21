import Entry from './Entry';
import { UserAvatar } from './elements/Avatars';
import { MessageRole } from '@/features/chat/types/message';
import { MessageEntry } from '@/features/chat/types/entry';
import { EditUserEntryForm } from '@/features/chat/components/forms/EditUserEntryForm';
import { useChat } from '@/features/chat/providers/ChatProvider';

type UserEntryProps = Readonly<{
  entry: MessageEntry;
}>;

export function EditableUserEntry({ entry }: UserEntryProps) {
  const { useGraph } = useChat();

  return (
    <Entry
      id={entry.id}
      avatar={<UserAvatar />}
      role={MessageRole.User}
      useGraph={useGraph}
    >
      <EditUserEntryForm entry={entry} />
    </Entry>
  );
}
