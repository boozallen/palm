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
  const { entryBeingEdited } = useChat();
  const { selectedText, userMessage } = selectedTextSentParser(entry.content);

  return entryBeingEdited === entry.id ? (
    <EditableUserEntry entry={entry} />
  ) : (
    <Entry
      id={entry.id}
      avatar={<UserAvatar />}
      role={MessageRole.User}
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
    </Entry>
  );
}
