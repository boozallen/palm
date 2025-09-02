import Entry from './Entry';
import { UserAvatar } from './elements/Avatars';
import { MessageRole } from '@/features/chat/types/message';
import { MessageEntry } from '@/features/chat/types/entry';
import { EditUserEntryForm } from '@/features/chat/components/forms/EditUserEntryForm';

type UserEntryProps = Readonly<{
  entry: MessageEntry;
}>;

export function EditableUserEntry({ entry }: UserEntryProps) {
  return (
    <Entry
      id={entry.id}
      avatar={<UserAvatar />}
      role={MessageRole.User}
    >
      <EditUserEntryForm entry={entry} />
    </Entry>
  );
}
